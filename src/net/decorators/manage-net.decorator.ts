import { SetMetadata } from '@nestjs/common';

export const MANAGE_NET_KEY = 'manage-net';
export const ManageNet = () => SetMetadata(MANAGE_NET_KEY, 'netId');
