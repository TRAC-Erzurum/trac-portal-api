import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Disaster } from '../../disaster/entities/disaster.entity';
import { Observation } from '../../disaster/entities/observation.entity';
import { ObservationType } from '../../disaster/enums/observation-type.enum';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/services/user.service';
import { TARGET_TYPE_TRANSLATION } from '../constants/type-translation';
import { UpdateDisasterPublishingDto } from '../dto/update-disaster-publishing.dto';
import { PublicationQueueItem } from '../entities/publication-queue-item.entity';
import { PublishTarget } from '../entities/publish-target.entity';
import { PublicationStatus } from '../enums/publication-status.enum';
import { PUBLISHING_CLOCK, PublishingClock } from '../publishing.constants';
import { buildTargetRecord, RecordKind } from '../utils/target-record.util';

export interface PublicationIssue {
  observationId: string;
  observationType: ObservationType | null;
  /** `FAILED`: refused for good. `PENDING`: tried and failed, will be retried. */
  status: PublicationStatus.FAILED | PublicationStatus.PENDING;
  observedAt: string;
  description: string | null;
  /** What the target answered, e.g. `422 {"error":"..."}` or `network: ECONNREFUSED`. */
  lastResult: string | null;
  attempts: number;
  lastAttemptAt: Date | null;
}

export interface DisasterPublishingView {
  enabled: boolean;
  target: {
    id: string;
    name: string;
    active: boolean;
    authFailing: boolean;
  } | null;
  /** Active targets a disaster administrator may choose from. */
  availableTargets: { id: string; name: string }[];
  /** `alreadyExisted` is the part of `delivered` the target already held. */
  counts: {
    waiting: number;
    delivered: number;
    failed: number;
    alreadyExisted: number;
  };
  /** Observations of this disaster the target has not been given yet. */
  notSent: number;
  /** Records refused for good, or still being retried after an error. */
  issues: PublicationIssue[];
}

export interface DisasterSyncResult extends DisasterPublishingView {
  /** Observations queued by this sync. */
  queued: number;
  /** Refused records put back in the queue by this sync. */
  retried: number;
}

/** The most issues one view lists. */
const MAX_LISTED_ISSUES = 50;

/**
 * What an observation is published as, or `null` when it never is.
 * `parentStatus` is the queue status of its parent for the same target.
 */
function recordKindFor(
  observation: Observation,
  parentStatus: PublicationStatus | undefined,
): RecordKind | null {
  const translation = TARGET_TYPE_TRANSLATION[observation.type];
  if (translation.kind === 'skip') return null;
  if (translation.kind === 'resolve') {
    const parentId = observation.parentObservationId;
    // A resolve for a record the target will never have could never succeed.
    if (
      !parentId ||
      !parentStatus ||
      parentStatus === PublicationStatus.FAILED
    ) {
      return null;
    }
    return { kind: 'resolve', resolves: parentId };
  }
  return translation;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === '23505'
  );
}

@Injectable()
export class PublicationService {
  constructor(
    @InjectRepository(Disaster)
    private readonly disasterRepository: Repository<Disaster>,
    @InjectRepository(PublishTarget)
    private readonly targetRepository: Repository<PublishTarget>,
    @InjectRepository(PublicationQueueItem)
    private readonly queueRepository: Repository<PublicationQueueItem>,
    @InjectRepository(Observation)
    private readonly observationRepository: Repository<Observation>,
    private readonly userService: UserService,
    @Inject(PUBLISHING_CLOCK) private readonly clock: PublishingClock,
  ) {}

  private async findDisaster(id: string): Promise<Disaster> {
    const disaster = await this.disasterRepository.findOne({ where: { id } });
    if (!disaster) throw new NotFoundException('error.notFound');
    return disaster;
  }

  async getDisasterPublishing(
    disasterId: string,
  ): Promise<DisasterPublishingView> {
    const disaster = await this.findDisaster(disasterId);
    const target = disaster.publishTargetId
      ? await this.targetRepository.findOne({
          where: { id: disaster.publishTargetId },
        })
      : null;
    const active = await this.targetRepository.find({
      where: { active: true },
      order: { name: 'ASC' },
    });
    const count = (status: PublicationStatus) =>
      this.queueRepository.count({ where: { disasterId, status } });

    const rows = target
      ? await this.queueRepository.find({
          where: { disasterId, targetId: target.id },
        })
      : [];
    const observations = target
      ? await this.observationRepository.find({
          where: { disasterId },
          order: { createdAt: 'ASC' },
        })
      : [];

    return {
      enabled: disaster.publishingEnabled,
      target: target
        ? {
            id: target.id,
            name: target.name,
            active: target.active,
            authFailing: !!target.authFailedAt,
          }
        : null,
      availableTargets: active.map((t) => ({ id: t.id, name: t.name })),
      counts: {
        waiting: await count(PublicationStatus.PENDING),
        delivered: await count(PublicationStatus.DELIVERED),
        failed: await count(PublicationStatus.FAILED),
        alreadyExisted: rows.filter(
          (r) => r.status === PublicationStatus.DELIVERED && r.alreadyExisted,
        ).length,
      },
      notSent: this.planBackfill(observations, rows).length,
      issues: this.listIssues(observations, rows),
    };
  }

  /** Rows refused for good or still failing: refused first, then newest. */
  private listIssues(
    observations: Observation[],
    rows: PublicationQueueItem[],
  ): PublicationIssue[] {
    const byId = new Map(observations.map((o) => [o.id, o]));
    const refused = (r: PublicationQueueItem) =>
      Number(r.status === PublicationStatus.FAILED);
    return rows
      .filter(
        (r) =>
          r.status === PublicationStatus.FAILED ||
          (r.status === PublicationStatus.PENDING && r.attempts > 0),
      )
      .sort(
        (a, b) =>
          refused(b) - refused(a) ||
          new Date(b.lastAttemptAt ?? 0).getTime() -
            new Date(a.lastAttemptAt ?? 0).getTime(),
      )
      .slice(0, MAX_LISTED_ISSUES)
      .map((r) => ({
        observationId: r.observationId,
        observationType: byId.get(r.observationId)?.type ?? null,
        status: r.status as PublicationIssue['status'],
        observedAt: r.payload.observedAt,
        description: r.payload.description ?? null,
        lastResult: r.lastResult,
        attempts: r.attempts,
        lastAttemptAt: r.lastAttemptAt,
      }));
  }

  /**
   * The observations a target has no queue row for yet, oldest first, with
   * what each is published as. Rows refused for good are about to be retried
   * by a sync, so for the resolve rule they count as waiting.
   */
  private planBackfill(
    observations: Observation[],
    rows: PublicationQueueItem[],
  ): { observation: Observation; kind: RecordKind }[] {
    const status = new Map<string, PublicationStatus>(
      rows.map((r) => [
        r.observationId,
        r.status === PublicationStatus.FAILED
          ? PublicationStatus.PENDING
          : r.status,
      ]),
    );
    const missing: { observation: Observation; kind: RecordKind }[] = [];
    for (const observation of observations) {
      if (status.has(observation.id)) continue;
      const kind = recordKindFor(
        observation,
        observation.parentObservationId
          ? status.get(observation.parentObservationId)
          : undefined,
      );
      if (!kind) continue;
      missing.push({ observation, kind });
      status.set(observation.id, PublicationStatus.PENDING);
    }
    return missing;
  }

  /**
   * Turns publishing on or off and chooses the target. Turning it off only
   * stops delivery of queued rows; nothing already delivered is withdrawn.
   */
  async updateDisasterPublishing(
    disasterId: string,
    dto: UpdateDisasterPublishingDto,
    actorEmail: string,
  ): Promise<DisasterPublishingView> {
    const disaster = await this.findDisaster(disasterId);
    let targetId = disaster.publishTargetId;

    if (dto.targetId !== undefined && dto.targetId !== targetId) {
      if (dto.targetId !== null) {
        const target = await this.targetRepository.findOne({
          where: { id: dto.targetId },
        });
        if (!target?.active) {
          throw new BadRequestException('error.publishTargetNotFound');
        }
      }
      targetId = dto.targetId;
    }
    const enabled = dto.enabled ?? disaster.publishingEnabled;
    if (enabled && !targetId) {
      throw new BadRequestException('error.publishTargetRequired');
    }

    await this.disasterRepository.update(
      { id: disasterId },
      {
        publishingEnabled: enabled,
        publishTargetId: targetId,
        updatedBy: [...(disaster.updatedBy ?? []), actorEmail],
      },
    );
    return this.getDisasterPublishing(disasterId);
  }

  /**
   * Sends what the target does not have yet: observations made before
   * publishing was turned on (archived disasters included), and records it
   * refused, which go back in the queue. Delivery is the ordinary one — one
   * request per record, oldest first — and the target's own duplicate check
   * makes a record it already holds harmless.
   */
  async syncDisaster(
    disasterId: string,
    actorEmail: string,
  ): Promise<DisasterSyncResult> {
    const disaster = await this.findDisaster(disasterId);
    const targetId = disaster.publishTargetId;
    if (!targetId) throw new BadRequestException('error.publishTargetRequired');
    const target = await this.targetRepository.findOne({
      where: { id: targetId },
    });
    if (!target?.active) {
      throw new BadRequestException('error.publishTargetNotFound');
    }
    if (!disaster.publishingEnabled) {
      throw new BadRequestException('error.publishingNotEnabled');
    }

    const observations = await this.observationRepository.find({
      where: { disasterId },
      order: { createdAt: 'ASC' },
    });
    const rows = await this.queueRepository.find({
      where: { disasterId, targetId },
    });
    const missing = this.planBackfill(observations, rows);
    const at = this.clock();

    let retried = 0;
    for (const row of rows) {
      if (row.status !== PublicationStatus.FAILED) continue;
      await this.queueRepository.update(
        { id: row.id },
        {
          status: PublicationStatus.PENDING,
          attempts: 0,
          nextAttemptAt: at,
          lastAttemptAt: null,
          lastResult: null,
          alreadyExisted: false,
          updatedBy: [...(row.updatedBy ?? []), actorEmail],
        },
      );
      retried++;
    }

    // One row per statement, in the observations' own order: the queue is
    // worked oldest-first, so a resolve never overtakes the record it resolves.
    const reporters = new Map<string, User>();
    let queued = 0;
    for (const { observation, kind } of missing) {
      let reporter = reporters.get(observation.createdByUserId);
      if (!reporter) {
        try {
          reporter = await this.userService.findOne(
            observation.createdByUserId,
          );
        } catch {
          continue; // its author is gone; it stays in `notSent`
        }
        reporters.set(observation.createdByUserId, reporter);
      }
      try {
        await this.queueRepository.save(
          this.queueRepository.create({
            observationId: observation.id,
            disasterId,
            targetId,
            status: PublicationStatus.PENDING,
            payload: buildTargetRecord(observation, reporter, kind),
            attempts: 0,
            nextAttemptAt: at,
            lastAttemptAt: null,
            lastResult: null,
            deliveredAt: null,
            alreadyExisted: false,
            createdBy: actorEmail,
            updatedBy: [],
          }),
        );
        queued++;
      } catch (error) {
        // A concurrent sync (or a live observation) queued it first.
        if (!isUniqueViolation(error)) throw error;
      }
    }

    return {
      ...(await this.getDisasterPublishing(disasterId)),
      queued,
      retried,
    };
  }

  /**
   * Queues a just-created observation for its disaster's target, when that
   * disaster's publishing is on. Observations created while it is off are
   * never queued.
   *
   * `manager` is the transaction the observation was inserted in: the queue
   * row must commit or roll back with it, or a failure between the two would
   * leave an observation that silently never publishes.
   */
  async enqueueObservation(
    observation: Observation,
    manager?: EntityManager,
  ): Promise<void> {
    const disasterRepository =
      manager?.getRepository(Disaster) ?? this.disasterRepository;
    const queueRepository =
      manager?.getRepository(PublicationQueueItem) ?? this.queueRepository;

    const disaster = await disasterRepository.findOne({
      where: { id: observation.disasterId },
    });
    if (!disaster) throw new NotFoundException('error.notFound');
    const targetId = disaster.publishTargetId;
    if (!disaster.publishingEnabled || !targetId) return;

    const parentRow = observation.parentObservationId
      ? await queueRepository.findOne({
          where: { observationId: observation.parentObservationId, targetId },
        })
      : null;
    const kind = recordKindFor(observation, parentRow?.status);
    if (!kind) return;

    const reporter = await this.userService.findOne(
      observation.createdByUserId,
    );
    await queueRepository.save(
      queueRepository.create({
        observationId: observation.id,
        disasterId: observation.disasterId,
        targetId,
        status: PublicationStatus.PENDING,
        payload: buildTargetRecord(observation, reporter, kind),
        attempts: 0,
        nextAttemptAt: this.clock(),
        lastAttemptAt: null,
        lastResult: null,
        deliveredAt: null,
        alreadyExisted: false,
        createdBy: observation.createdBy,
        updatedBy: [],
      }),
    );
  }
}
