import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  type EffectiveRole,
  GlobalRole,
  effectiveRoleMeetsMinimum,
} from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ALLOW_WITHOUT_CALLSIGN_KEY } from '../decorators/allow-without-callsign.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const allowWithoutCallsign = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WITHOUT_CALLSIGN_KEY,
      [context.getHandler(), context.getClass()],
    );

    const { user } = context.switchToHttp().getRequest();
    const userRole = user.role as EffectiveRole;

    if (
      !user.callSign &&
      !allowWithoutCallsign &&
      userRole === GlobalRole.GUEST
    ) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    const requiredRoles = this.reflector.getAllAndOverride<EffectiveRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const hasRole = requiredRoles.some((required) =>
      effectiveRoleMeetsMinimum(userRole, required),
    );

    if (!hasRole) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    return true;
  }
}
