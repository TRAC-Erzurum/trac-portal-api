import { SetMetadata } from '@nestjs/common';

export const MANAGE_SESSION_KEY = 'manage-session';
export const ManageSession = () => SetMetadata(MANAGE_SESSION_KEY, 'sessionId');
