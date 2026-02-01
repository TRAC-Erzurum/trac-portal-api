import { ActivityType, EntityType } from '../enums/activity-type.enum';

export class ActivityEvent {
  constructor(
    public readonly type: ActivityType,
    public readonly entityType: EntityType,
    public readonly entityId: string | null,
    public readonly userId: string | null,
    public readonly actorCallSign: string | null,
    public readonly targetCallSign: string | null,
    public readonly metadata: Record<string, unknown> = {},
  ) {}
}

export const ACTIVITY_EVENT = 'activity.created';
