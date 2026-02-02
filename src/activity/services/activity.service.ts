import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from '../entities/activity.entity';
import { ActivityType, EntityType } from '../enums/activity-type.enum';

export interface CreateActivityDto {
  type: ActivityType;
  entityType: EntityType;
  entityId?: string;
  userId?: string;
  actorCallSign?: string;
  targetCallSign?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityFeedItem {
  id: string;
  type: ActivityType;
  entityType: EntityType;
  entityId: string | null;
  actorCallSign: string | null;
  targetCallSign: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
  ) {}

  async create(dto: CreateActivityDto): Promise<Activity> {
    const activity = this.activityRepository.create({
      type: dto.type,
      entityType: dto.entityType,
      entityId: dto.entityId || null,
      userId: dto.userId || null,
      actorCallSign: dto.actorCallSign || null,
      targetCallSign: dto.targetCallSign || null,
      metadata: dto.metadata || {},
    });

    const saved = await this.activityRepository.save(activity);
    this.logger.debug(`Activity created: ${dto.type} by ${dto.actorCallSign}`);
    return saved;
  }

  async findRecentForUser(
    userId: string,
    limit: number = 10,
  ): Promise<ActivityFeedItem[]> {
    const activities = await this.activityRepository.find({
      where: [
        { userId },
        { targetCallSign: await this.getCallSignForUser(userId) },
      ],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return activities.map(this.toFeedItem);
  }

  async findRecentGlobal(limit: number = 10): Promise<ActivityFeedItem[]> {
    const activities = await this.activityRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return activities.map(this.toFeedItem);
  }

  async findByEntity(
    entityType: EntityType,
    entityId: string,
    limit: number = 20,
  ): Promise<ActivityFeedItem[]> {
    const activities = await this.activityRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return activities.map(this.toFeedItem);
  }

  private toFeedItem(activity: Activity): ActivityFeedItem {
    return {
      id: activity.id,
      type: activity.type,
      entityType: activity.entityType,
      entityId: activity.entityId,
      actorCallSign: activity.actorCallSign,
      targetCallSign: activity.targetCallSign,
      metadata: activity.metadata,
      createdAt: activity.createdAt,
    };
  }

  private async getCallSignForUser(userId: string): Promise<string | null> {
    const activity = await this.activityRepository.findOne({
      where: { userId },
      select: ['actorCallSign'],
    });
    return activity?.actorCallSign || null;
  }
}
