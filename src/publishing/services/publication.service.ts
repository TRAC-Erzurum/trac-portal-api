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
import { SaveDisasterPublishingDto } from '../dto/save-disaster-publishing.dto';
import { PublicationQueueItem } from '../entities/publication-queue-item.entity';
import { PublishTarget } from '../entities/publish-target.entity';
import { PublicationStatus } from '../enums/publication-status.enum';
import {
  PUBLISHING_CLOCK,
  PUBLISHING_PHOTO_GRACE_MS,
  PublishingClock,
} from '../publishing.constants';
import { isAcceptableIntakeUrl } from '../utils/intake-url.util';
import { buildTargetRecord, RecordKind } from '../utils/target-record.util';

export interface DisasterPublishingView {
  /** `null` until the disaster has been given a recipient. */
  target: { name: string; intakeUrl: string } | null;
  enabled: boolean;
  counts: {
    delivered: number;
    /** The part of `delivered` the recipient already held. */
    alreadyExisted: number;
    failed: number;
    /** Queued, not tried yet. */
    waiting: number;
  };
  /** Observations of this disaster the recipient has not been given yet. */
  notSent: number;
}

export interface PublicationHistoryItem {
  id: string;
  observationId: string;
  observationType: ObservationType | null;
  observedAt: string;
  description: string | null;
  status: PublicationStatus;
  alreadyExisted: boolean;
  /** What the recipient answered, e.g. `409 {"error":"..."}` or `network: ECONNREFUSED`. */
  lastResult: string | null;
  lastAttemptAt: Date | null;
}

export interface PublicationHistoryPage {
  items: PublicationHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface DisasterSyncResult extends DisasterPublishingView {
  /** Observations queued by this sync. */
  queued: number;
  /** Failed records the sync put back in the queue. */
  retried: number;
}

const DEFAULT_HISTORY_LIMIT = 25;
const MAX_HISTORY_LIMIT = 100;

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
    @Inject(PUBLISHING_PHOTO_GRACE_MS) private readonly photoGraceMs: number,
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
    const count = (status: PublicationStatus) =>
      rows.filter((r) => r.status === status).length;

    return {
      target: target
        ? { name: target.name, intakeUrl: target.intakeUrl }
        : null,
      enabled: disaster.publishingEnabled,
      counts: {
        delivered: count(PublicationStatus.DELIVERED),
        alreadyExisted: rows.filter(
          (r) => r.status === PublicationStatus.DELIVERED && r.alreadyExisted,
        ).length,
        failed: count(PublicationStatus.FAILED),
        waiting: count(PublicationStatus.PENDING),
      },
      notSent: this.planBackfill(observations, rows).length,
    };
  }

  /**
   * The disaster's recipient and the switch. The first save needs a key;
   * later ones may leave it out to keep the current one. Switching off only
   * stops delivery of queued rows; nothing already delivered is withdrawn.
   */
  async saveDisasterPublishing(
    disasterId: string,
    dto: SaveDisasterPublishingDto,
    actorEmail: string,
  ): Promise<DisasterPublishingView> {
    const disaster = await this.findDisaster(disasterId);
    const name = dto.name.trim();
    const intakeUrl = dto.intakeUrl.trim();
    const sharedSecret = dto.sharedSecret?.trim();
    if (!name) throw new BadRequestException('error.publishTargetNameRequired');
    if (!isAcceptableIntakeUrl(intakeUrl)) {
      throw new BadRequestException('error.publishTargetUrlInvalid');
    }

    let target = disaster.publishTargetId
      ? await this.targetRepository.findOne({
          where: { id: disaster.publishTargetId },
        })
      : null;
    if (!target) {
      if (!sharedSecret) {
        throw new BadRequestException('error.publishTargetKeyRequired');
      }
      target = await this.targetRepository.save(
        this.targetRepository.create({
          name,
          intakeUrl,
          sharedSecret,
          createdBy: actorEmail,
          updatedBy: [],
        }),
      );
    } else {
      target.name = name;
      target.intakeUrl = intakeUrl;
      if (sharedSecret) target.sharedSecret = sharedSecret;
      target.updatedBy = [...(target.updatedBy ?? []), actorEmail];
      await this.targetRepository.save(target);
    }

    await this.disasterRepository.update(
      { id: disasterId },
      {
        publishingEnabled: dto.enabled,
        publishTargetId: target.id,
        updatedBy: [...(disaster.updatedBy ?? []), actorEmail],
      },
    );
    return this.getDisasterPublishing(disasterId);
  }

  /** What has been sent for this disaster, newest first. */
  async getHistory(
    disasterId: string,
    query: { page?: number; limit?: number; status?: PublicationStatus },
  ): Promise<PublicationHistoryPage> {
    const disaster = await this.findDisaster(disasterId);
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const limit = Math.min(
      MAX_HISTORY_LIMIT,
      Math.max(1, Math.floor(query.limit ?? DEFAULT_HISTORY_LIMIT)),
    );
    if (!disaster.publishTargetId) return { items: [], total: 0, page, limit };

    const rows = (
      await this.queueRepository.find({
        where: { disasterId, targetId: disaster.publishTargetId },
      })
    )
      .filter((r) => !query.status || r.status === query.status)
      .sort(
        (a, b) =>
          new Date(b.lastAttemptAt ?? b.createdAt).getTime() -
          new Date(a.lastAttemptAt ?? a.createdAt).getTime(),
      );
    const byId = new Map(
      (await this.observationRepository.find({ where: { disasterId } })).map(
        (o) => [o.id, o],
      ),
    );
    const items = rows.slice((page - 1) * limit, page * limit).map(
      (r): PublicationHistoryItem => ({
        id: r.id,
        observationId: r.observationId,
        observationType: byId.get(r.observationId)?.type ?? null,
        observedAt: r.payload.observedAt,
        description: r.payload.description ?? null,
        status: r.status,
        alreadyExisted: r.alreadyExisted,
        lastResult: r.lastResult,
        lastAttemptAt: r.lastAttemptAt,
      }),
    );
    return { items, total: rows.length, page, limit };
  }

  /**
   * The observations a target has no queue row for yet, oldest first, with
   * what each is published as. Failed rows are about to be sent again by a
   * sync, so for the resolve rule they count as waiting.
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
   * The disaster's target and whether its rows may go out. Sharing has to
   * be on — except for an archived disaster, which takes no new observations
   * and so has nothing "live" to switch on: sending its history is the point,
   * and it switches itself on for that.
   */
  private async requireSendable(
    disasterId: string,
    actorEmail: string,
  ): Promise<{ disaster: Disaster; targetId: string }> {
    const disaster = await this.findDisaster(disasterId);
    const targetId = disaster.publishTargetId;
    if (!targetId) throw new BadRequestException('error.publishTargetRequired');
    const target = await this.targetRepository.findOne({
      where: { id: targetId },
    });
    if (!target) throw new BadRequestException('error.publishTargetNotFound');
    if (!disaster.publishingEnabled) {
      if (!disaster.archivedAt) {
        throw new BadRequestException('error.publishingNotEnabled');
      }
      await this.disasterRepository.update(
        { id: disasterId },
        {
          publishingEnabled: true,
          updatedBy: [...(disaster.updatedBy ?? []), actorEmail],
        },
      );
    }
    return { disaster, targetId };
  }

  /** Puts one failed record back in the queue, for one more attempt. */
  async retryItem(
    disasterId: string,
    itemId: string,
    actorEmail: string,
  ): Promise<PublicationHistoryItem> {
    const { targetId } = await this.requireSendable(disasterId, actorEmail);
    const row = await this.queueRepository.findOne({ where: { id: itemId } });
    if (!row || row.disasterId !== disasterId || row.targetId !== targetId) {
      throw new NotFoundException('error.notFound');
    }
    if (row.status !== PublicationStatus.FAILED) {
      throw new BadRequestException('error.publicationNotFailed');
    }
    await this.requeue(row, this.clock(), actorEmail);
    const page = await this.getHistory(disasterId, {
      limit: MAX_HISTORY_LIMIT,
    });
    const item = page.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('error.notFound');
    return item;
  }

  private async requeue(
    row: PublicationQueueItem,
    at: Date,
    actorEmail: string,
  ): Promise<void> {
    await this.queueRepository.update(
      { id: row.id },
      {
        status: PublicationStatus.PENDING,
        nextAttemptAt: at,
        alreadyExisted: false,
        updatedBy: [...(row.updatedBy ?? []), actorEmail],
      },
    );
  }

  /**
   * Sends what the recipient has not been given: observations made before
   * sharing was turned on (archived disasters included) and records it
   * refused, which go back in the queue. Records already delivered are left
   * alone. Delivery is the ordinary one — one request per record, oldest
   * first, one attempt each.
   */
  async syncDisaster(
    disasterId: string,
    actorEmail: string,
  ): Promise<DisasterSyncResult> {
    const { targetId } = await this.requireSendable(disasterId, actorEmail);

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
      await this.requeue(row, at, actorEmail);
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
   * disaster's sharing is on. Observations created while it is off are
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
        nextAttemptAt: new Date(this.clock().getTime() + this.photoGraceMs),
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
