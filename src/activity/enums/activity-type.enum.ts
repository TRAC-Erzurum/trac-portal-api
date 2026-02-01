export enum ActivityType {
  NET_CREATED = 'net.created',
  NET_STARTED = 'net.started',
  NET_ENDED = 'net.ended',
  NET_UPDATED = 'net.updated',
  NET_DELETED = 'net.deleted',

  ATTENDEE_ADDED = 'attendee.added',
  ATTENDEE_UPDATED = 'attendee.updated',
  ATTENDEE_REMOVED = 'attendee.removed',

  OPERATOR_CREATED = 'operator.created',
  OPERATOR_UPDATED = 'operator.updated',

  USER_UPDATED = 'user.updated',
  USER_AVATAR_CHANGED = 'user.avatar_changed',
}

export enum EntityType {
  NET = 'net',
  ATTENDEE = 'attendee',
  OPERATOR = 'operator',
  USER = 'user',
}
