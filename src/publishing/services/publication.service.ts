import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Disaster } from '../../disaster/entities/disaster.entity';
import { Observation } from '../../disaster/entities/observation.entity';
import { UserService } from '../../user/services/user.service';
import { TARGET_TYPE_TRANSLATION } from '../constants/type-translation';
import { UpdateDisasterPublishingDto } from '../dto/update-disaster-publishing.dto';
import { PublicationQueueItem } from '../entities/publication-queue-item.entity';
import { PublishTarget } from '../entities/publish-target.entity';
import { PublicationStatus } from '../enums/publication-status.enum';
import { PUBLISHING_CLOCK, PublishingClock } from '../publishing.constants';
import { buildTargetRecord, RecordKind } from '../utils/target-record.util';

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
  counts: { waiting: number; delivered: number; failed: number };
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
      },
    };
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

    const translation = TARGET_TYPE_TRANSLATION[observation.type];
    let kind: RecordKind;
    if (translation.kind === 'skip') return;
    if (translation.kind === 'resolve') {
      const parentId = observation.parentObservationId;
      if (!parentId) return;
      // A resolve for a record the target will never have could never succeed.
      const parentRow = await queueRepository.findOne({
        where: { observationId: parentId, targetId },
      });
      if (!parentRow || parentRow.status === PublicationStatus.FAILED) return;
      kind = { kind: 'resolve', resolves: parentId };
    } else {
      kind = translation;
    }

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
        createdBy: observation.createdBy,
        updatedBy: [],
      }),
    );
  }
}
