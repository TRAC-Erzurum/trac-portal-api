export enum ActivityType {
  NET_CREATED = 'net.created',
  NET_CREATED_FROM_SCHEDULER = 'net.created_from_scheduler',
  NET_STARTED = 'net.started',
  NET_ENDED = 'net.ended',
  ATTENDEE_ADDED = 'attendee.added',
  MEMBERSHIP_APPROVED = 'membership.approved',
  MEMBERSHIP_REJECTED = 'membership.rejected',
  MEMBERSHIP_REMOVED = 'membership.removed',
  MEMBERSHIP_ROLE_UPDATED = 'membership.role_updated',
  DISASTER_CREATED = 'disaster.created',
  DISASTER_ARCHIVED = 'disaster.archived',
  OBSERVATION_CREATED = 'observation.created',
  OBSERVATION_UPDATED = 'observation.updated',
  OBSERVATION_SUPPORTED = 'observation.supported',
  OBSERVATION_CONTRADICTED = 'observation.contradicted',
}

export enum EntityType {
  NET = 'net',
  ATTENDEE = 'attendee',
  MEMBERSHIP = 'membership',
  DISASTER = 'disaster',
  OBSERVATION = 'observation',
}
