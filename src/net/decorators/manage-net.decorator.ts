import { SetMetadata } from '@nestjs/common';

export const MANAGE_NET_KEY = 'manage-net';

/** Net silme: yalnız süper admin veya çevrimin şubesinde onaylı şube yöneticisi/başkan (çevrim operatörü yetmez). */
export const MANAGE_NET_DELETE_LEADERSHIP_ONLY_KEY =
  'manage-net-delete-leadership-only';

/** Route param that holds the net id (e.g. `netId` on `net/:netId/attendee`, `id` on `net/:id/start`). */
export const ManageNet = (routeParamKey: string = 'netId') =>
  SetMetadata(MANAGE_NET_KEY, routeParamKey);

export const ManageNetDeleteLeadershipOnly = () =>
  SetMetadata(MANAGE_NET_DELETE_LEADERSHIP_ONLY_KEY, true);
