import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GlobalRole } from '../../auth/enums/role.enum';
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

    if (user.role === GlobalRole.SUPER_ADMIN) {
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
    if (membership?.status === MembershipStatus.APPROVED) {
      return true;
    }

    const canLead = await this.membershipService.canActAsBranchLeaderOnBranch(
      String(user.id),
      String(branchId),
    );
    if (canLead) {
      return true;
    }

    throw new ForbiddenException('error.forbiddenDescription');
  }
}
