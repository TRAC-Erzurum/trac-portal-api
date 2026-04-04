import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GlobalRole } from '../../auth/enums/role.enum';
import { MembershipService } from '../services/membership.service';

@Injectable()
export class BranchAdminGuard implements CanActivate {
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

    const canLead = await this.membershipService.canActAsBranchLeaderOnBranch(
      String(user.id),
      String(branchId),
    );
    if (!canLead) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    return true;
  }
}
