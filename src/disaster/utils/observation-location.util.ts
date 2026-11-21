import { BadRequestException } from '@nestjs/common';

export interface RootObservationLocationInput {
  lat?: number | null;
  lng?: number | null;
  locationLabel?: string | null;
}

export interface RootObservationLocation {
  lat: number | null;
  lng: number | null;
  locationLabel: string | null;
}

/**
 * Coordinates are optional for a root observation, but must be given as a
 * pair. Without coordinates a location label (province and district) is
 * required.
 */
export function resolveRootObservationLocation(
  input: RootObservationLocationInput,
): RootObservationLocation {
  const hasLat = input.lat !== undefined && input.lat !== null;
  const hasLng = input.lng !== undefined && input.lng !== null;
  if (hasLat !== hasLng) {
    throw new BadRequestException('error.invalidData');
  }

  const locationLabel = input.locationLabel?.trim() || null;
  if (!hasLat && !locationLabel) {
    throw new BadRequestException('error.invalidData');
  }

  return {
    lat: hasLat ? input.lat : null,
    lng: hasLng ? input.lng : null,
    locationLabel,
  };
}
