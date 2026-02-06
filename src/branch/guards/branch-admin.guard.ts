import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../auth/enums/role.enum';
import { MembershipService } from '../services/membership.service';
import { BranchRole } from '../enums/branch-role.enum';
import { MembershipStatus } from '../enums/membership-status.enum';

@Injectable()
export class BranchAdminGuard implements CanActivate {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const branchId = request.params.branchId ?? request.params.id;
    if (!branchId) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    const membership = await this.membershipService.findMembership(
      String(user.id),
      String(branchId),
    );
    if (
      !membership ||
      membership.status !== MembershipStatus.APPROVED ||
      (membership.role !== BranchRole.ADMIN &&
        membership.role !== BranchRole.PRESIDENT)
    ) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    return true;
  }
}
