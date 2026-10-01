import { performance } from 'perf_hooks';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Disaster } from '../../disaster/entities/disaster.entity';
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
  PUBLISHING_CLOCK,
  PublishingClock,
} from '../publishing.constants';
import { TargetRecord } from '../types/target-record.types';
import {
  classifyResponse,
  DeliveryOutcome,
  retryDelayMs,
  signDelivery,
} from '../utils/delivery.util';
import {
  EligiblePair,
  PublicationQueueClaimer,
} from './publication-queue-claimer';

export interface DeliveryRunSummary {
  claimed: number;
  delivered: number;
  retrying: number;
  failed: number;
}

interface SendResult {
  /** `null` for a network failure or timeout. */
  status: number | null;
  detail: string;
  /** Network error code when there was no response. */
  error?: string;
  durationMs: number;
}

const ATTEMPT_LEVEL: Record<DeliveryOutcome, EventLevel> = {
  delivered: 'info',
  retry: 'warn',
  failed: 'error',
  'authentication-failed': 'error',
};

/** Sends due queue rows to their targets, signed, one record per request. */
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
    private readonly claimer: PublicationQueueClaimer,
    @Inject(PUBLISHING_CLOCK) private readonly clock: PublishingClock,
  ) {}

  /**
   * Targets rows may be sent to right now: active, not held by a 401, and
   * selected by a disaster whose publishing is on.
   */
  private async eligiblePairs(): Promise<EligiblePair[]> {
    const targets = new Map(
      (await this.targetRepository.find({ where: { active: true } }))
        .filter((t) => !t.authFailedAt)
        .map((t) => [t.id, t]),
    );
    const disasters = await this.disasterRepository.find({
      where: { publishingEnabled: true },
    });
    return disasters
      .filter((d) => d.publishTargetId && targets.has(d.publishTargetId))
      .map((d) => ({ disasterId: d.id, targetId: d.publishTargetId }));
  }

  async deliverDue(): Promise<DeliveryRunSummary> {
    const summary: DeliveryRunSummary = {
      claimed: 0,
      delivered: 0,
      retrying: 0,
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

    const heldTargets = new Set<string>();
    for (const row of rows) {
      // Sends in a run are sequential and may take a while, so the switch and
      // the target are read again right before each one: a disaster turned off
      // (or a target changed) mid-run must not let the rest of the batch out.
      const target = heldTargets.has(row.targetId)
        ? null
        : await this.sendableTarget(row);
      if (!target) {
        await this.release(row);
        continue;
      }
      if (await this.resolvesFailedRecord(row)) {
        await this.finish(row, PublicationStatus.FAILED, 'parent failed');
        this.logAttempt(row, 'failed', {
          status: null,
          error: 'parent_failed',
          nextAttemptAt: null,
        });
        summary.failed++;
        continue;
      }

      const result = await this.send(target, row.payload);
      const at = this.clock();
      const outcome = classifyResponse(result.status);
      const attempt = {
        status: result.status,
        error: result.error,
        durationMs: result.durationMs,
      };
      switch (outcome) {
        case 'delivered':
          await this.finish(row, PublicationStatus.DELIVERED, result.detail);
          this.logAttempt(row, outcome, { ...attempt, nextAttemptAt: null });
          summary.delivered++;
          break;
        case 'failed':
          await this.finish(row, PublicationStatus.FAILED, result.detail);
          this.logAttempt(row, outcome, { ...attempt, nextAttemptAt: null });
          summary.failed++;
          break;
        case 'retry': {
          const attempts = row.attempts + 1;
          const nextAttemptAt = new Date(at.getTime() + retryDelayMs(attempts));
          await this.queueRepository.update(
            { id: row.id },
            {
              attempts,
              lastAttemptAt: at,
              lastResult: result.detail,
              nextAttemptAt,
            },
          );
          this.logAttempt(row, outcome, { ...attempt, nextAttemptAt });
          summary.retrying++;
          break;
        }
        case 'authentication-failed':
          // A configuration error: hold every row of the target until its
          // credentials change instead of failing them all permanently.
          // Only while the secret is still the one that was just refused.
          await this.targetRepository.update(
            { id: target.id, sharedSecret: target.sharedSecret },
            { authFailedAt: at },
          );
          heldTargets.add(target.id);
          await this.queueRepository.update(
            { id: row.id },
            {
              attempts: row.attempts + 1,
              lastAttemptAt: at,
              lastResult: result.detail,
              nextAttemptAt: at,
            },
          );
          // Held until the target's secret changes: no scheduled next attempt.
          this.logAttempt(row, outcome, { ...attempt, nextAttemptAt: null });
          summary.retrying++;
          break;
      }
    }
    return summary;
  }

  /**
   * One line per delivery attempt: target, disaster, observation, the
   * target's HTTP status, the classification, the attempt count and when the
   * next attempt is due. Never the payload, the response body or the secret.
   */
  private logAttempt(
    row: PublicationQueueItem,
    classification: DeliveryOutcome,
    attempt: {
      status: number | null;
      error?: string;
      durationMs?: number;
      nextAttemptAt: Date | null;
    },
  ): void {
    this.logger.write(ATTEMPT_LEVEL[classification], {
      event: 'publishing.delivery',
      targetId: row.targetId,
      disasterId: row.disasterId,
      observationId: row.observationId,
      status: attempt.status,
      classification,
      attempt: row.attempts + 1,
      nextAttemptAt: attempt.nextAttemptAt?.toISOString() ?? null,
      durationMs: attempt.durationMs,
      error: attempt.error,
    });
  }

  /** The row's target, if its disaster still publishes to it and it is usable now. */
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
    const target = await this.targetRepository.findOne({
      where: { id: row.targetId },
    });
    return target?.active && !target.authFailedAt ? target : null;
  }

  /** A resolve whose record was refused for good can never succeed. */
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
      },
    );
  }

  private async send(
    target: PublishTarget,
    payload: TargetRecord,
  ): Promise<SendResult> {
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(this.clock().getTime() / 1000);
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    try {
      const res = await fetch(target.intakeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Source-Id': target.sourceId,
          'X-Timestamp': String(timestamp),
          'X-Signature': signDelivery(target.sharedSecret, timestamp, rawBody),
        },
        body: rawBody,
        redirect: 'manual',
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });
      const text = await res.text().catch(() => '');
      return {
        status: res.status,
        detail: `${res.status} ${text}`.trim().slice(0, 500),
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
