import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '../../auth/enums/role.enum';
import { MembershipService } from '../services/membership.service';
import { MembershipStatus } from '../enums/membership-status.enum';

@Injectable()
export class BranchMemberGuard implements CanActivate {
  constructor(private readonly membershipService: MembershipService) {}

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
      user.id,
      branchId,
    );
    if (!membership || membership.status !== MembershipStatus.APPROVED) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    return true;
  }
}
