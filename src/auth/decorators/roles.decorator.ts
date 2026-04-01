import { SetMetadata } from '@nestjs/common';
import { type EffectiveRole } from '../enums/role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: EffectiveRole[]) =>
  SetMetadata(ROLES_KEY, roles);
