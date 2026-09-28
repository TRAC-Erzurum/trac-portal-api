import { ObservationType } from '../../disaster/enums/observation-type.enum';

/** The target contract's 14 record types. */
export type TargetRecordType =
  | 'collapsedBuilding'
  | 'damagedBuilding'
  | 'roadBlocked'
  | 'infrastructureFailure'
  | 'assemblyArea'
  | 'medicalPoint'
  | 'other'
  | 'fire'
  | 'gasLeak'
  | 'electricalHazard'
  | 'injured'
  | 'deceased'
  | 'rescueNeeded'
  | 'resourceNeed';

/**
 * - `record`: a new record of that type at the target.
 * - `resolve`: no new record; reports the parent observation's record resolved.
 * - `skip`: progress types, never published (the contract has no equivalent
 *   and sending them as new records would misreport them).
 */
export type TypeTranslation =
  | { kind: 'record'; type: TargetRecordType }
  | { kind: 'resolve' }
  | { kind: 'skip' };

const record = (type: TargetRecordType): TypeTranslation => ({
  kind: 'record',
  type,
});
const RESOLVE: TypeTranslation = { kind: 'resolve' };
const SKIP: TypeTranslation = { kind: 'skip' };

/** The portal's 26 observation types translated to the target contract's 14. */
export const TARGET_TYPE_TRANSLATION: Record<ObservationType, TypeTranslation> =
  {
    [ObservationType.COLLAPSED_BUILDING]: record('collapsedBuilding'),
    [ObservationType.DAMAGED_BUILDING]: record('damagedBuilding'),
    [ObservationType.ROAD_BLOCKED]: record('roadBlocked'),
    [ObservationType.INFRASTRUCTURE_FAILURE]: record('infrastructureFailure'),
    [ObservationType.ASSEMBLY_AREA]: record('assemblyArea'),
    [ObservationType.MEDICAL_POINT]: record('medicalPoint'),
    [ObservationType.OTHER]: record('other'),
    [ObservationType.FIRE]: record('fire'),
    [ObservationType.GAS_LEAK]: record('gasLeak'),
    [ObservationType.ELECTRICAL_HAZARD]: record('electricalHazard'),
    [ObservationType.INJURED]: record('injured'),
    [ObservationType.DECEASED]: record('deceased'),
    [ObservationType.RESCUE_REQUIRED]: record('rescueNeeded'),
    [ObservationType.RESOURCE_NEED]: record('resourceNeed'),
    [ObservationType.FIRE_EXTINGUISHED]: RESOLVE,
    [ObservationType.GAS_LEAK_RESOLVED]: RESOLVE,
    [ObservationType.POWER_ISOLATED]: RESOLVE,
    [ObservationType.INJURED_EVACUATED]: RESOLVE,
    [ObservationType.RESCUE_COMPLETED]: RESOLVE,
    [ObservationType.RESOURCE_FULFILLED]: RESOLVE,
    [ObservationType.ROAD_OPENED]: RESOLVE,
    [ObservationType.SERVICE_RESTORED]: RESOLVE,
    [ObservationType.RESOURCE_DISPATCHED]: SKIP,
    [ObservationType.RESOURCE_DELIVERED]: SKIP,
    [ObservationType.DEBRIS_REMOVED]: SKIP,
    [ObservationType.STRUCTURE_SECURED]: SKIP,
  };
