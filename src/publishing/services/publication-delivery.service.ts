import { performance } from 'perf_hooks';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Disaster } from '../../disaster/entities/disaster.entity';
import { ObservationPhoto } from '../../disaster/entities/observation-photo.entity';
import { PublicationQueueItem } from '../entities/publication-queue-item.entity';
import { PublishTarget } from '../entities/publish-target.entity';
import { PublicationStatus } from '../enums/publication-status.enum';
import {
  EventLevel,
  EventLogger,
  safeId,
} from '../../shared/logging/event-logger';
import {
  CLAIM_LEASE_MS,
  DELIVERY_BATCH_SIZE,
  DELIVERY_TIMEOUT_MS,
  MAX_PHOTOS_PER_RECORD,
  PUBLISHING_CLOCK,
  PublishingClock,
} from '../publishing.constants';
import { TargetRecord } from '../types/target-record.types';
import { classifyResponse, DeliveryOutcome } from '../utils/delivery.util';
import {
  EligiblePair,
  PublicationQueueClaimer,
} from './publication-queue-claimer';

export interface DeliveryRunSummary {
  claimed: number;
  delivered: number;
  failed: number;
}

interface SendResult {
  /** `null` for a network failure or timeout. */
  status: number | null;
  detail: string;
  /** The target answered 200 `duplicate`: it already had the record. */
  alreadyExisted?: boolean;
  /** Network error code when there was no response. */
  error?: string;
  durationMs: number;
}

const ATTEMPT_LEVEL: Record<DeliveryOutcome, EventLevel> = {
  delivered: 'info',
  failed: 'error',
};

/** `{ duplicate: true }`: the target's answer for a record it already holds. */
function isDuplicateBody(text: string): boolean {
  try {
    return (JSON.parse(text) as { duplicate?: unknown })?.duplicate === true;
  } catch {
    return false;
  }
}

/**
 * Sends due queue rows to their targets, one record per request, once each:
 * a record the target took is delivered, anything else is failed, and only a
 * person puts a failed record back (retry, or sync).
 */
@Injectable()
export class PublicationDeliveryService {
  private readonly logger = new EventLogger(PublicationDeliveryService.name);

  constructor(
    @InjectRepository(Disaster)
    private readonly disasterRepository: Repository<Disaster>,
    @InjectRepository(PublishTarget)
    private readonly targetRepository: Repository<PublishTarget>,
    @InjectRepository(PublicationQueueItem)
    private readonly queueRepository: Repository<PublicationQueueItem>,
    @InjectRepository(ObservationPhoto)
    private readonly photoRepository: Repository<ObservationPhoto>,
    private readonly config: ConfigService,
    private readonly claimer: PublicationQueueClaimer,
    @Inject(PUBLISHING_CLOCK) private readonly clock: PublishingClock,
  ) {}

  /** Disasters whose sharing is on, with the target they share with. */
  private async eligiblePairs(): Promise<EligiblePair[]> {
    const disasters = await this.disasterRepository.find({
      where: { publishingEnabled: true },
    });
    return disasters
      .filter((d) => d.publishTargetId)
      .map((d) => ({ disasterId: d.id, targetId: d.publishTargetId }));
  }

  async deliverDue(): Promise<DeliveryRunSummary> {
    const summary: DeliveryRunSummary = {
      claimed: 0,
      delivered: 0,
      failed: 0,
    };
    const pairs = await this.eligiblePairs();
    if (pairs.length === 0) return summary;

    const now = this.clock();
    const rows = await this.claimer.claim(
      now,
      new Date(now.getTime() + CLAIM_LEASE_MS),
      DELIVERY_BATCH_SIZE,
      pairs,
    );
    summary.claimed = rows.length;
    rows.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    for (const row of rows) {
      // Sends in a run are sequential and may take a while, so the switch and
      // the target are read again right before each one: a disaster turned off
      // (or a target changed) mid-run must not let the rest of the batch out.
      const target = await this.sendableTarget(row);
      if (!target) {
        await this.release(row);
        continue;
      }
      if (await this.resolvesFailedRecord(row)) {
        await this.finish(row, PublicationStatus.FAILED, 'parent failed');
        this.logAttempt(row, 'failed', {
          status: null,
          error: 'parent_failed',
        });
        summary.failed++;
        continue;
      }

      const result = await this.send(target, await this.withPhotos(row));
      const outcome = classifyResponse(result.status);
      const attempt = {
        status: result.status,
        error: result.error,
        durationMs: result.durationMs,
      };
      if (outcome === 'delivered') {
        await this.finish(
          row,
          PublicationStatus.DELIVERED,
          result.detail,
          result.alreadyExisted,
        );
        summary.delivered++;
      } else {
        await this.finish(row, PublicationStatus.FAILED, result.detail);
        summary.failed++;
      }
      this.logAttempt(row, outcome, attempt);
    }
    return summary;
  }

  /**
   * One line per delivery attempt: target, disaster, observation, the
   * target's HTTP status and the classification. Never the payload, the
   * response body or the key.
   */
  private logAttempt(
    row: PublicationQueueItem,
    classification: DeliveryOutcome,
    attempt: { status: number | null; error?: string; durationMs?: number },
  ): void {
    this.logger.write(ATTEMPT_LEVEL[classification], {
      event: 'publishing.delivery',
      targetId: row.targetId,
      disasterId: row.disasterId,
      observationId: row.observationId,
      status: attempt.status,
      classification,
      attempt: row.attempts + 1,
      durationMs: attempt.durationMs,
      error: attempt.error,
    });
  }

  /** The row's target, if its disaster still shares with it and sharing is on. */
  private async sendableTarget(
    row: PublicationQueueItem,
  ): Promise<PublishTarget | null> {
    const disaster = await this.disasterRepository.findOne({
      where: { id: row.disasterId },
    });
    if (
      !disaster?.publishingEnabled ||
      disaster.publishTargetId !== row.targetId
    ) {
      return null;
    }
    return this.targetRepository.findOne({ where: { id: row.targetId } });
  }

  /**
   * The row's record with its photos' public addresses, read now: they are
   * uploaded after the observation, so the queued payload cannot have them.
   * The target downloads them (only from the origin it was told to expect);
   * one it cannot fetch never costs it the record.
   */
  private async withPhotos(row: PublicationQueueItem): Promise<TargetRecord> {
    const origin = this.config
      .get<string>('PUBLIC_API_ORIGIN')
      ?.replace(/\/+$/, '');
    if (!origin || row.payload.resolves) return row.payload;
    const photos = (
      await this.photoRepository.find({
        where: { observationId: row.observationId },
        order: { sortOrder: 'ASC' },
      })
    ).slice(0, MAX_PHOTOS_PER_RECORD);
    if (photos.length === 0) return row.payload;
    return {
      ...row.payload,
      photos: photos.map((p) => `${origin}/${p.filePath.replace(/^\/+/, '')}`),
    };
  }

  /** A resolve whose record was refused can only be refused too. */
  private async resolvesFailedRecord(
    row: PublicationQueueItem,
  ): Promise<boolean> {
    const resolves = row.payload.resolves;
    if (!resolves) return false;
    const parent = await this.queueRepository.findOne({
      where: { observationId: resolves, targetId: row.targetId },
    });
    return parent?.status === PublicationStatus.FAILED;
  }

  /** Gives a claimed row back without counting an attempt. */
  private async release(row: PublicationQueueItem): Promise<void> {
    await this.queueRepository.update(
      { id: row.id },
      { nextAttemptAt: this.clock() },
    );
  }

  private async finish(
    row: PublicationQueueItem,
    status: PublicationStatus.DELIVERED | PublicationStatus.FAILED,
    detail: string,
    alreadyExisted = false,
  ): Promise<void> {
    const at = this.clock();
    await this.queueRepository.update(
      { id: row.id },
      {
        status,
        attempts: row.attempts + 1,
        lastAttemptAt: at,
        lastResult: detail,
        deliveredAt: status === PublicationStatus.DELIVERED ? at : null,
        alreadyExisted,
      },
    );
  }

  private async send(
    target: PublishTarget,
    payload: TargetRecord,
  ): Promise<SendResult> {
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    try {
      const res = await fetch(target.intakeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${target.sharedSecret}`,
        },
        body: JSON.stringify(payload),
        redirect: 'manual',
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });
      const text = await res.text().catch(() => '');
      return {
        status: res.status,
        detail: `${res.status} ${text}`.trim().slice(0, 500),
        alreadyExisted: res.status === 200 && isDuplicateBody(text),
        durationMs: elapsed(),
      };
    } catch (error) {
      const err = error as { name?: string; cause?: { code?: string } };
      const code = err.cause?.code ?? err.name ?? 'error';
      return {
        status: null,
        detail: `network: ${code}`,
        error: safeId(code),
        durationMs: elapsed(),
      };
    }
  }
}
