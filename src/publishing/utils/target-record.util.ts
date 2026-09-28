import { Observation } from '../../disaster/entities/observation.entity';
import { isVerifiedOperator } from '../../oidc/utils/claims.util';
import { User } from '../../user/entities/user.entity';
import { TargetRecordType } from '../constants/type-translation';
import { TargetRecord } from '../types/target-record.types';

export type RecordKind =
  | { kind: 'record'; type: TargetRecordType }
  | { kind: 'resolve'; resolves: string };

/**
 * The target record for an observation. The parent link and photos are
 * deliberately absent: the target keeps records flat, and photos are only
 * reachable with a portal session. `locationPrecision` is omitted because
 * the portal does not record it.
 */
export function buildTargetRecord(
  observation: Observation,
  reporter: User,
  kind: RecordKind,
): TargetRecord {
  const record: TargetRecord = {
    externalId: observation.id,
    externalIncidentId: observation.disasterId,
    observedAt: new Date(observation.eventTime).toISOString(),
    reporter: {
      email: reporter.email,
      label:
        reporter.operator?.callSign ||
        reporter.fullName ||
        reporter.operator?.fullName ||
        reporter.email,
      // Same rule the OIDC provider releases as `verified`.
      verified: isVerifiedOperator(reporter),
    },
  };
  if (kind.kind === 'record') record.type = kind.type;
  else record.resolves = kind.resolves;
  if (observation.severity)
    record.severity =
      observation.severity.toLowerCase() as TargetRecord['severity'];
  if (observation.description) record.description = observation.description;
  if (typeof observation.lat === 'number') record.lat = observation.lat;
  if (typeof observation.lng === 'number') record.lng = observation.lng;
  if (observation.locationLabel)
    record.locationLabel = observation.locationLabel;
  return record;
}
