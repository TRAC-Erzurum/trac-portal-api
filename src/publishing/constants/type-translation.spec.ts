import { ObservationType } from '../../disaster/enums/observation-type.enum';
import { TARGET_TYPE_TRANSLATION } from './type-translation';

describe('translation of the 26 observation types to the target contract', () => {
  it.each([
    [
      ObservationType.COLLAPSED_BUILDING,
      { kind: 'record', type: 'collapsedBuilding' },
    ],
    [
      ObservationType.DAMAGED_BUILDING,
      { kind: 'record', type: 'damagedBuilding' },
    ],
    [ObservationType.ROAD_BLOCKED, { kind: 'record', type: 'roadBlocked' }],
    [
      ObservationType.INFRASTRUCTURE_FAILURE,
      { kind: 'record', type: 'infrastructureFailure' },
    ],
    [ObservationType.ASSEMBLY_AREA, { kind: 'record', type: 'assemblyArea' }],
    [ObservationType.MEDICAL_POINT, { kind: 'record', type: 'medicalPoint' }],
    [ObservationType.OTHER, { kind: 'record', type: 'other' }],
    [ObservationType.FIRE, { kind: 'record', type: 'fire' }],
    [ObservationType.GAS_LEAK, { kind: 'record', type: 'gasLeak' }],
    [
      ObservationType.ELECTRICAL_HAZARD,
      { kind: 'record', type: 'electricalHazard' },
    ],
    [ObservationType.INJURED, { kind: 'record', type: 'injured' }],
    [ObservationType.DECEASED, { kind: 'record', type: 'deceased' }],
    [ObservationType.RESCUE_REQUIRED, { kind: 'record', type: 'rescueNeeded' }],
    [ObservationType.RESOURCE_NEED, { kind: 'record', type: 'resourceNeed' }],
    [ObservationType.FIRE_EXTINGUISHED, { kind: 'resolve' }],
    [ObservationType.GAS_LEAK_RESOLVED, { kind: 'resolve' }],
    [ObservationType.POWER_ISOLATED, { kind: 'resolve' }],
    [ObservationType.INJURED_EVACUATED, { kind: 'resolve' }],
    [ObservationType.RESCUE_COMPLETED, { kind: 'resolve' }],
    [ObservationType.RESOURCE_FULFILLED, { kind: 'resolve' }],
    [ObservationType.ROAD_OPENED, { kind: 'resolve' }],
    [ObservationType.SERVICE_RESTORED, { kind: 'resolve' }],
    [ObservationType.RESOURCE_DISPATCHED, { kind: 'skip' }],
    [ObservationType.RESOURCE_DELIVERED, { kind: 'skip' }],
    [ObservationType.DEBRIS_REMOVED, { kind: 'skip' }],
    [ObservationType.STRUCTURE_SECURED, { kind: 'skip' }],
  ])('%s → %j', (type, expected) => {
    expect(TARGET_TYPE_TRANSLATION[type]).toEqual(expected);
  });

  it('covers every portal type exactly once', () => {
    expect(Object.keys(TARGET_TYPE_TRANSLATION).sort()).toEqual(
      Object.values(ObservationType).sort(),
    );
  });
});
