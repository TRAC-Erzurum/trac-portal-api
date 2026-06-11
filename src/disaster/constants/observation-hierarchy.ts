import { ObservationType } from '../enums/observation-type.enum';

export const ROOT_OBSERVATION_TYPES: ObservationType[] = [
  ObservationType.COLLAPSED_BUILDING,
  ObservationType.DAMAGED_BUILDING,
  ObservationType.ROAD_BLOCKED,
  ObservationType.INFRASTRUCTURE_FAILURE,
  ObservationType.ASSEMBLY_AREA,
  ObservationType.MEDICAL_POINT,
  ObservationType.OTHER,
];

const BASE_OBSERVATION_HIERARCHY: Record<ObservationType, ObservationType[]> = {
  [ObservationType.COLLAPSED_BUILDING]: [
    ObservationType.FIRE,
    ObservationType.GAS_LEAK,
    ObservationType.ELECTRICAL_HAZARD,
    ObservationType.INJURED,
    ObservationType.DECEASED,
    ObservationType.RESCUE_REQUIRED,
    ObservationType.RESOURCE_NEED,
    ObservationType.DEBRIS_REMOVED,
    ObservationType.STRUCTURE_SECURED,
  ],
  [ObservationType.DAMAGED_BUILDING]: [
    ObservationType.FIRE,
    ObservationType.GAS_LEAK,
    ObservationType.ELECTRICAL_HAZARD,
    ObservationType.INJURED,
    ObservationType.RESOURCE_NEED,
    ObservationType.STRUCTURE_SECURED,
  ],
  [ObservationType.ROAD_BLOCKED]: [
    ObservationType.DEBRIS_REMOVED,
    ObservationType.ROAD_OPENED,
  ],
  [ObservationType.INFRASTRUCTURE_FAILURE]: [
    ObservationType.RESOURCE_NEED,
    ObservationType.SERVICE_RESTORED,
  ],
  [ObservationType.ASSEMBLY_AREA]: [
    ObservationType.RESOURCE_NEED,
    ObservationType.RESOURCE_DELIVERED,
    ObservationType.RESOURCE_FULFILLED,
  ],
  [ObservationType.MEDICAL_POINT]: [
    ObservationType.RESOURCE_NEED,
    ObservationType.RESOURCE_DELIVERED,
    ObservationType.RESOURCE_FULFILLED,
    ObservationType.INJURED,
    ObservationType.INJURED_EVACUATED,
  ],
  [ObservationType.OTHER]: [
    ObservationType.FIRE,
    ObservationType.GAS_LEAK,
    ObservationType.ELECTRICAL_HAZARD,
    ObservationType.INJURED,
    ObservationType.RESOURCE_NEED,
    ObservationType.RESCUE_REQUIRED,
  ],
  [ObservationType.FIRE]: [],
  [ObservationType.FIRE_EXTINGUISHED]: [],
  [ObservationType.GAS_LEAK]: [],
  [ObservationType.GAS_LEAK_RESOLVED]: [],
  [ObservationType.ELECTRICAL_HAZARD]: [],
  [ObservationType.POWER_ISOLATED]: [],
  [ObservationType.INJURED]: [],
  [ObservationType.INJURED_EVACUATED]: [],
  [ObservationType.DECEASED]: [],
  [ObservationType.RESCUE_REQUIRED]: [],
  [ObservationType.RESCUE_COMPLETED]: [],
  [ObservationType.RESOURCE_NEED]: [],
  [ObservationType.RESOURCE_DISPATCHED]: [],
  [ObservationType.RESOURCE_DELIVERED]: [],
  [ObservationType.RESOURCE_FULFILLED]: [],
  [ObservationType.DEBRIS_REMOVED]: [],
  [ObservationType.STRUCTURE_SECURED]: [],
  [ObservationType.ROAD_OPENED]: [],
  [ObservationType.SERVICE_RESTORED]: [],
};

const LIFECYCLE_FOLLOW_UPS: Array<{
  childType: ObservationType;
  parentRoots: ObservationType[];
}> = [
  {
    childType: ObservationType.FIRE_EXTINGUISHED,
    parentRoots: [
      ObservationType.COLLAPSED_BUILDING,
      ObservationType.DAMAGED_BUILDING,
      ObservationType.OTHER,
    ],
  },
  {
    childType: ObservationType.GAS_LEAK_RESOLVED,
    parentRoots: [
      ObservationType.COLLAPSED_BUILDING,
      ObservationType.DAMAGED_BUILDING,
      ObservationType.OTHER,
    ],
  },
  {
    childType: ObservationType.POWER_ISOLATED,
    parentRoots: [
      ObservationType.COLLAPSED_BUILDING,
      ObservationType.DAMAGED_BUILDING,
      ObservationType.OTHER,
    ],
  },
  {
    childType: ObservationType.RESCUE_COMPLETED,
    parentRoots: [ObservationType.COLLAPSED_BUILDING, ObservationType.OTHER],
  },
  {
    childType: ObservationType.RESOURCE_DISPATCHED,
    parentRoots: [
      ObservationType.COLLAPSED_BUILDING,
      ObservationType.DAMAGED_BUILDING,
      ObservationType.INFRASTRUCTURE_FAILURE,
      ObservationType.ASSEMBLY_AREA,
      ObservationType.MEDICAL_POINT,
      ObservationType.OTHER,
    ],
  },
];

function buildObservationHierarchy(): Record<
  ObservationType,
  ObservationType[]
> {
  const hierarchy: Record<ObservationType, ObservationType[]> = {
    ...BASE_OBSERVATION_HIERARCHY,
  };

  for (const root of ROOT_OBSERVATION_TYPES) {
    hierarchy[root] = [...(hierarchy[root] ?? [])];
  }

  for (const { childType, parentRoots } of LIFECYCLE_FOLLOW_UPS) {
    for (const root of parentRoots) {
      if (!hierarchy[root].includes(childType)) {
        hierarchy[root].push(childType);
      }
    }
  }

  return hierarchy;
}

export const OBSERVATION_HIERARCHY = buildObservationHierarchy();

export function isRootType(type: ObservationType): boolean {
  return ROOT_OBSERVATION_TYPES.includes(type);
}

export function isChildAllowed(
  parentType: ObservationType,
  childType: ObservationType,
): boolean {
  const allowed = OBSERVATION_HIERARCHY[parentType];
  return allowed?.includes(childType) ?? false;
}
