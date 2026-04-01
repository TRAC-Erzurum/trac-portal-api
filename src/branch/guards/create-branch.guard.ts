import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GlobalRole, BranchRole } from '../../auth/enums/role.enum';
import { MembershipService } from '../services/membership.service';

@Injectable()
export class CreateBranchGuard implements CanActivate {
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

    const ok = await this.membershipService.hasApprovedPresidentInAnyBranch(
      String(user.id),
    );
    if (!ok) {
      throw new ForbiddenException('error.noPermission');
    }

    return true;
  }
}
