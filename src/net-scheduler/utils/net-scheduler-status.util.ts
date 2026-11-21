import { NetRecurrence } from '../enums/net-recurrence.enum';

/** Computed lifecycle state of a net plan (not stored). */
export type NetSchedulerStatus = 'active' | 'paused' | 'ended';

/**
 * Classify a plan for `today` (YYYY-MM-DD, GMT+3).
 * - ended: endDate is before today, or it is one-time and already has a net.
 * - paused: isActive is false and it has not ended.
 * - active: otherwise.
 */
export function classifyNetSchedulerStatus(
  scheduler: {
    isActive: boolean;
    endDate: string | null;
    recurrence: NetRecurrence;
  },
  hasNet: boolean,
  today: string,
): NetSchedulerStatus {
  const endedByDate = scheduler.endDate != null && scheduler.endDate < today;
  const oneTimeDone = scheduler.recurrence === NetRecurrence.ONE_TIME && hasNet;
  if (endedByDate || oneTimeDone) return 'ended';
  return scheduler.isActive ? 'active' : 'paused';
}

/** Shift a YYYY-MM-DD date by a number of days (calendar arithmetic, no timezone drift). */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}
