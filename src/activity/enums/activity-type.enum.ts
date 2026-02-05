export enum ActivityType {
  NET_CREATED = 'net.created',
  NET_STARTED = 'net.started',
  NET_ENDED = 'net.ended',
  ATTENDEE_ADDED = 'attendee.added',
  MEMBERSHIP_APPROVED = 'membership.approved',
  MEMBERSHIP_REJECTED = 'membership.rejected',
  MEMBERSHIP_REMOVED = 'membership.removed',
}

export enum EntityType {
  NET = 'net',
  ATTENDEE = 'attendee',
  MEMBERSHIP = 'membership',
}
