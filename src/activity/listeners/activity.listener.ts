import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityService } from '../services/activity.service';
import { ActivityEvent, ACTIVITY_EVENT } from '../events/activity.events';

@Injectable()
export class ActivityListener {
  private readonly logger = new Logger(ActivityListener.name);

  constructor(private readonly activityService: ActivityService) {}

  @OnEvent(ACTIVITY_EVENT)
  async handleActivityEvent(event: ActivityEvent): Promise<void> {
    try {
      await this.activityService.create({
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        userId: event.userId,
        actorCallSign: event.actorCallSign,
        targetCallSign: event.targetCallSign,
        metadata: event.metadata,
      });
    } catch (error) {
      this.logger.error(`Failed to create activity: ${error.message}`, error.stack);
    }
  }
}
