import { Request } from 'express';
import { AuthUser } from '../../auth/types/auth.types';

export interface RequestWithUser extends Request {
  user: AuthUser;
}
