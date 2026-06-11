import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import {
  ActivityEvent,
  ACTIVITY_EVENT,
} from '../../activity/events/activity.events';
import {
  ActivityType,
  EntityType,
} from '../../activity/enums/activity-type.enum';
import { Observation } from '../entities/observation.entity';
import { ObservationPhoto } from '../entities/observation-photo.entity';
import { CreateObservationDto } from '../dto/create-observation.dto';
import { ObservationQueryDto } from '../dto/observation-query.dto';
import { SimilarObservationQueryDto } from '../dto/similar-observation-query.dto';
import { isChildAllowed, isRootType } from '../constants/observation-hierarchy';
import { DisasterService } from './disaster.service';
import { ObservationScoringService } from './observation-scoring.service';
@Injectable()
export class ObservationService {
  constructor(
    @InjectRepository(Observation)
    private readonly observationRepository: Repository<Observation>,
    @InjectRepository(ObservationPhoto)
    private readonly photoRepository: Repository<ObservationPhoto>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly disasterService: DisasterService,
    private readonly scoringService: ObservationScoringService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private readonly MAX_PHOTOS = 5;

  async findRanked(
    disasterId: string,
    query: ObservationQueryDto,
  ): Promise<
    Array<
      Observation & {
        rankingScore: number;
        conflicting: boolean;
        reporterCallSign: string | null;
        reporterEmail: string | null;
      }
    >
  > {
    await this.disasterService.findOne(disasterId);

    const qb = this.observationRepository
      .createQueryBuilder('observation')
      .leftJoinAndSelect('observation.photos', 'photos')
      .where('observation.disasterId = :disasterId', { disasterId });

    if (query.rootOnly) {
      qb.andWhere('observation.parentObservationId IS NULL');
    }

    const observations = await qb.getMany();

    for (const observation of observations) {
      observation.photos?.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    const reporterUserIds = [
      ...new Set(observations.map((o) => o.createdByUserId)),
    ];

    const reporterMap = new Map<
      string,
      { callSign: string | null; email: string }
    >();

    if (reporterUserIds.length > 0) {
      const users = await this.userRepository.find({
        where: { id: In(reporterUserIds) },
        relations: { operator: true },
      });
      for (const user of users) {
        reporterMap.set(user.id, {
          callSign: user.operator?.callSign ?? null,
          email: user.email,
        });
      }
    }

    const ranked = await Promise.all(
      observations.map(async (observation) => {
        const rankingScore =
          await this.scoringService.rankingScore(observation);
        const conflicting =
          await this.scoringService.isConflicting(observation);
        const reporter = reporterMap.get(observation.createdByUserId);
        return {
          ...observation,
          rankingScore,
          conflicting,
          reporterCallSign: reporter?.callSign ?? null,
          reporterEmail: reporter?.email ?? null,
        };
      }),
    );

    ranked.sort((a, b) => b.rankingScore - a.rankingScore);
    return ranked;
  }

  async findSimilar(
    disasterId: string,
    query: SimilarObservationQueryDto,
  ): Promise<Observation[]> {
    const disaster = await this.disasterService.findOne(disasterId);
    this.disasterService.assertNotArchived(disaster);

    const config = await this.scoringService.getConfig();
    const radiusMeters = config.duplicateRadiusMeters;
    const { lat, lng } = query;

    const latDelta = radiusMeters / 111320;
    const lngDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));

    const candidates = await this.observationRepository
      .createQueryBuilder('observation')
      .where('observation.disasterId = :disasterId', { disasterId })
      .andWhere('observation.parentObservationId IS NULL')
      .andWhere('observation.type = :type', { type: query.type })
      .andWhere('observation.lat BETWEEN :minLat AND :maxLat', {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
      })
      .andWhere('observation.lng BETWEEN :minLng AND :maxLng', {
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
      })
      .getMany();

    return candidates.filter(
      (obs) =>
        this.haversineDistanceMeters(lat, lng, obs.lat, obs.lng) <=
        radiusMeters,
    );
  }

  async findOneWithChildren(id: string): Promise<Observation> {
    const observation = await this.observationRepository.findOne({
      where: { id },
      relations: { children: { photos: true }, photos: true },
    });
    if (!observation) {
      throw new NotFoundException('error.notFound');
    }

    observation.children.sort(
      (a, b) =>
        new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime(),
    );

    return observation;
  }

  async uploadPhotos(
    observationId: string,
    filePaths: string[],
  ): Promise<ObservationPhoto[]> {
    const observation = await this.observationRepository.findOne({
      where: { id: observationId },
      relations: { photos: true },
    });
    if (!observation) {
      throw new NotFoundException('error.notFound');
    }

    const existingCount = observation.photos?.length ?? 0;
    if (existingCount + filePaths.length > this.MAX_PHOTOS) {
      throw new BadRequestException('error.tooManyPhotos');
    }

    const photos = filePaths.map((filePath, index) =>
      this.photoRepository.create({
        observationId,
        filePath,
        sortOrder: existingCount + index,
      }),
    );

    return this.photoRepository.save(photos);
  }

  async create(
    disasterId: string,
    dto: CreateObservationDto,
    userId: string,
    actorEmail: string,
    actorCallSign?: string,
  ): Promise<Observation> {
    const disaster = await this.disasterService.findOne(disasterId);
    this.disasterService.assertNotArchived(disaster);

    let lat: number;
    let lng: number;
    let locationLabel: string | null;
    let parentObservationId: string | null = null;

    if (dto.parentObservationId) {
      const parent = await this.observationRepository.findOne({
        where: { id: dto.parentObservationId, disasterId },
      });
      if (!parent) {
        throw new NotFoundException('error.notFound');
      }
      if (!isRootType(parent.type)) {
        throw new BadRequestException('error.invalidData');
      }
      if (!isChildAllowed(parent.type, dto.type)) {
        throw new BadRequestException('error.invalidData');
      }

      parentObservationId = parent.id;
      lat = parent.lat;
      lng = parent.lng;
      locationLabel = parent.locationLabel;
    } else {
      if (!isRootType(dto.type)) {
        throw new BadRequestException('error.invalidData');
      }
      if (dto.lat === undefined || dto.lng === undefined) {
        throw new BadRequestException('error.invalidData');
      }
      lat = dto.lat;
      lng = dto.lng;
      locationLabel = dto.locationLabel?.trim() || null;
    }

    const observation = this.observationRepository.create({
      disasterId,
      parentObservationId,
      type: dto.type,
      lat,
      lng,
      locationLabel,
      severity: dto.severity ?? null,
      description: dto.description?.trim() || null,
      eventTime: dto.eventTime ? new Date(dto.eventTime) : new Date(),
      createdByUserId: userId,
      createdBy: actorEmail,
      updatedBy: [],
    });

    const saved = await this.observationRepository.save(observation);
    await this.scoringService.recompute(saved.id);
    const refreshed = await this.observationRepository.findOne({
      where: { id: saved.id },
    });

    const activityType = parentObservationId
      ? ActivityType.OBSERVATION_UPDATED
      : ActivityType.OBSERVATION_CREATED;

    this.eventEmitter.emit(
      ACTIVITY_EVENT,
      new ActivityEvent(
        activityType,
        EntityType.OBSERVATION,
        saved.id,
        userId,
        actorCallSign ?? null,
        null,
        {
          disasterId,
          type: saved.type,
          parentObservationId,
        },
      ),
    );

    return refreshed ?? saved;
  }

  private haversineDistanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
