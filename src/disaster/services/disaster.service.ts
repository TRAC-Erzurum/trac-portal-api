import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import {
  ActivityEvent,
  ACTIVITY_EVENT,
} from '../../activity/events/activity.events';
import {
  ActivityType,
  EntityType,
} from '../../activity/enums/activity-type.enum';
import { Disaster } from '../entities/disaster.entity';
import { DisasterMembership } from '../entities/disaster-membership.entity';
import { Observation } from '../entities/observation.entity';
import { DisasterSettingConfig } from '../entities/disaster-setting.entity';
import { CreateDisasterDto } from '../dto/create-disaster.dto';
import { UpdateDisasterDto } from '../dto/update-disaster.dto';
import { DisasterQueryDto } from '../dto/disaster-query.dto';
import { DisasterRole } from '../enums/disaster-role.enum';
import { DisasterMembershipStatus } from '../enums/membership-status.enum';
import { ObservationSeverity } from '../enums/observation-severity.enum';
import {
  DisasterStats,
  DisasterWithStats,
} from '../types/disaster-stats.types';
import { ObservationScoringService } from './observation-scoring.service';

@Injectable()
export class DisasterService {
  constructor(
    @InjectRepository(Disaster)
    private readonly disasterRepository: Repository<Disaster>,
    @InjectRepository(DisasterMembership)
    private readonly membershipRepository: Repository<DisasterMembership>,
    @InjectRepository(Observation)
    private readonly observationRepository: Repository<Observation>,
    private readonly observationScoringService: ObservationScoringService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(query: DisasterQueryDto): Promise<{
    data: DisasterWithStats[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limitNum = Math.min(query.limit ?? 50, 100);
    const offsetNum = query.offset ?? 0;
    const status = query.status ?? 'active';

    const qb = this.disasterRepository.createQueryBuilder('disaster');

    if (status === 'active') {
      qb.where('disaster.archivedAt IS NULL').orderBy(
        'disaster.createdAt',
        'DESC',
      );
    } else {
      qb.where('disaster.archivedAt IS NOT NULL').orderBy(
        'disaster.archivedAt',
        'DESC',
      );
    }

    const total = await qb.getCount();
    const disasters = await qb.skip(offsetNum).take(limitNum).getMany();
    const statsMap = await this.computeStatsForDisasters(
      disasters.map((d) => d.id),
    );
    const data = disasters.map((disaster) =>
      this.withStats(disaster, statsMap),
    );

    return { data, total, limit: limitNum, offset: offsetNum };
  }

  async findOne(id: string): Promise<DisasterWithStats> {
    const disaster = await this.findEntityById(id);
    const statsMap = await this.computeStatsForDisasters([id]);
    return this.withStats(disaster, statsMap);
  }

  private async findEntityById(id: string): Promise<Disaster> {
    const disaster = await this.disasterRepository.findOne({ where: { id } });
    if (!disaster) {
      throw new NotFoundException('error.notFound');
    }
    return disaster;
  }

  private emptyStats(): DisasterStats {
    return {
      observationCount: 0,
      rootCount: 0,
      conflictingCount: 0,
      severityCounts: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      },
      lastObservationAt: null,
    };
  }

  private withStats(
    disaster: Disaster,
    statsMap: Map<string, DisasterStats>,
  ): DisasterWithStats {
    return {
      ...disaster,
      stats: statsMap.get(disaster.id) ?? this.emptyStats(),
    };
  }

  private isConflicting(
    observation: Pick<Observation, 'supportCount' | 'contradictCount'>,
    config: DisasterSettingConfig,
  ): boolean {
    const total = observation.supportCount + observation.contradictCount;
    if (total === 0) {
      return false;
    }
    return (
      observation.contradictCount >= config.conflict.minContradicts &&
      observation.contradictCount / total >= config.conflict.ratioThreshold
    );
  }

  private async computeStatsForDisasters(
    disasterIds: string[],
  ): Promise<Map<string, DisasterStats>> {
    const statsMap = new Map<string, DisasterStats>();
    for (const id of disasterIds) {
      statsMap.set(id, this.emptyStats());
    }
    if (disasterIds.length === 0) {
      return statsMap;
    }

    const config = await this.observationScoringService.getConfig();

    const totals = await this.observationRepository
      .createQueryBuilder('obs')
      .select('obs.disasterId', 'disasterId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(obs.createdAt)', 'lastObservationAt')
      .where('obs.disasterId IN (:...ids)', { ids: disasterIds })
      .groupBy('obs.disasterId')
      .getRawMany<{
        disasterId: string;
        count: string;
        lastObservationAt: Date | null;
      }>();

    for (const row of totals) {
      const stats = statsMap.get(row.disasterId)!;
      stats.observationCount = parseInt(row.count, 10);
      stats.lastObservationAt = row.lastObservationAt
        ? new Date(row.lastObservationAt).toISOString()
        : null;
    }

    const roots = await this.observationRepository
      .createQueryBuilder('obs')
      .select('obs.disasterId', 'disasterId')
      .addSelect('COUNT(*)', 'count')
      .where('obs.disasterId IN (:...ids)', { ids: disasterIds })
      .andWhere('obs.parentObservationId IS NULL')
      .groupBy('obs.disasterId')
      .getRawMany<{ disasterId: string; count: string }>();

    for (const row of roots) {
      const stats = statsMap.get(row.disasterId)!;
      stats.rootCount = parseInt(row.count, 10);
    }

    const severities = await this.observationRepository
      .createQueryBuilder('obs')
      .select('obs.disasterId', 'disasterId')
      .addSelect('obs.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('obs.disasterId IN (:...ids)', { ids: disasterIds })
      .andWhere('obs.parentObservationId IS NULL')
      .andWhere('obs.severity IS NOT NULL')
      .groupBy('obs.disasterId')
      .addGroupBy('obs.severity')
      .getRawMany<{
        disasterId: string;
        severity: ObservationSeverity;
        count: string;
      }>();

    for (const row of severities) {
      const stats = statsMap.get(row.disasterId)!;
      stats.severityCounts[row.severity] = parseInt(row.count, 10);
    }

    const rootObservations = await this.observationRepository
      .createQueryBuilder('obs')
      .select(['obs.disasterId', 'obs.supportCount', 'obs.contradictCount'])
      .where('obs.disasterId IN (:...ids)', { ids: disasterIds })
      .andWhere('obs.parentObservationId IS NULL')
      .getMany();

    for (const observation of rootObservations) {
      if (this.isConflicting(observation, config)) {
        const stats = statsMap.get(observation.disasterId)!;
        stats.conflictingCount++;
      }
    }

    return statsMap;
  }

  assertNotArchived(disaster: Disaster): void {
    if (disaster.archivedAt) {
      throw new BadRequestException('error.disasterArchived');
    }
  }

  async create(
    dto: CreateDisasterDto,
    userId: string,
    actorEmail: string,
    actorCallSign?: string,
  ): Promise<Disaster> {
    const disaster = this.disasterRepository.create({
      name: dto.name,
      type: dto.type,
      metadata: dto.metadata ?? null,
      createdBy: actorEmail,
      updatedBy: [],
    });
    const saved = await this.disasterRepository.save(disaster);

    const membership = this.membershipRepository.create({
      disasterId: saved.id,
      userId,
      role: DisasterRole.ADMIN,
      status: DisasterMembershipStatus.APPROVED,
      processedBy: userId,
      processedAt: new Date(),
      createdBy: actorEmail,
      updatedBy: [],
    });
    await this.membershipRepository.save(membership);

    this.eventEmitter.emit(
      ACTIVITY_EVENT,
      new ActivityEvent(
        ActivityType.DISASTER_CREATED,
        EntityType.DISASTER,
        saved.id,
        userId,
        actorCallSign ?? null,
        null,
        { name: saved.name, type: saved.type },
      ),
    );

    return saved;
  }

  async update(
    id: string,
    dto: UpdateDisasterDto,
    actorEmail: string,
  ): Promise<Disaster> {
    const disaster = await this.findEntityById(id);
    this.assertNotArchived(disaster);

    if (dto.name !== undefined) disaster.name = dto.name;
    if (dto.type !== undefined) disaster.type = dto.type;
    if (dto.metadata !== undefined) disaster.metadata = dto.metadata ?? null;
    disaster.updatedBy = [...(disaster.updatedBy || []), actorEmail];

    return this.disasterRepository.save(disaster);
  }

  async archive(
    id: string,
    userId: string,
    actorCallSign?: string,
  ): Promise<Disaster> {
    const disaster = await this.findEntityById(id);
    if (disaster.archivedAt) {
      throw new BadRequestException('error.disasterArchived');
    }

    disaster.archivedAt = new Date();
    const saved = await this.disasterRepository.save(disaster);

    this.eventEmitter.emit(
      ACTIVITY_EVENT,
      new ActivityEvent(
        ActivityType.DISASTER_ARCHIVED,
        EntityType.DISASTER,
        saved.id,
        userId,
        actorCallSign ?? null,
        null,
        { name: saved.name },
      ),
    );

    return saved;
  }

  async reactivate(id: string, actorEmail: string): Promise<Disaster> {
    const disaster = await this.findEntityById(id);
    if (!disaster.archivedAt) {
      return disaster;
    }

    disaster.archivedAt = null;
    disaster.updatedBy = [...(disaster.updatedBy || []), actorEmail];
    return this.disasterRepository.save(disaster);
  }
}
