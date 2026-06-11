import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { BranchRole, GlobalRole } from '../../auth/enums/role.enum';
import { MembershipService } from '../services/membership.service';

/**
 * Süper admin (`GlobalRole.SUPER_ADMIN`); JWT etkin rolü şube yöneticisi (`BranchRole.ADMIN`);
 * veya herhangi bir şubede onaylı başkan / yönetici üyeliği (`BranchRole.PRESIDENT` / `BranchRole.ADMIN`).
 */
@Injectable()
export class PortalOrBranchLeaderGuard implements CanActivate {
  constructor(private readonly membershipService: MembershipService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    if (
      user.role === GlobalRole.SUPER_ADMIN ||
      user.role === BranchRole.ADMIN ||
      user.role === BranchRole.PRESIDENT
    ) {
      return true;
    }

    const ok =
      await this.membershipService.hasApprovedBranchLeadershipInAnyBranch(
        String(user.id),
      );
    if (!ok) {
      throw new ForbiddenException('error.noPermission');
    }
    return true;
  }
}
