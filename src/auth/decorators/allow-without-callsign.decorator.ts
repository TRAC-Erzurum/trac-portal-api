import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_CALLSIGN_KEY = 'allowWithoutCallsign';
export const AllowWithoutCallsign = () =>
  SetMetadata(ALLOW_WITHOUT_CALLSIGN_KEY, true);
