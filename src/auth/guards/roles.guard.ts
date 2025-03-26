import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
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

    if (!user.callSign && !allowWithoutCallsign) {
      return false;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const roleHierarchy = {
      [Role.ADMIN]: [Role.ADMIN, Role.MEMBER, Role.VOLUNTEER, Role.GUEST],
      [Role.MEMBER]: [Role.MEMBER, Role.VOLUNTEER, Role.GUEST],
      [Role.VOLUNTEER]: [Role.VOLUNTEER, Role.GUEST],
      [Role.GUEST]: [Role.GUEST],
    };

    return requiredRoles.some((role) =>
      roleHierarchy[user.role]?.includes(role),
    );
  }
}
