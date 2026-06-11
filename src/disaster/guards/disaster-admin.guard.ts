import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GlobalRole } from '../../auth/enums/role.enum';
import { DisasterMembershipService } from '../services/disaster-membership.service';
import { DisasterService } from '../services/disaster.service';

@Injectable()
export class DisasterAdminGuard implements CanActivate {
  constructor(
    private readonly disasterMembershipService: DisasterMembershipService,
    private readonly disasterService: DisasterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('error.noPermission');
    }

    if (user.globalRole === GlobalRole.SUPER_ADMIN) {
      return true;
    }

    const disasterId =
      request.params.id ??
      request.params.disasterId ??
      request.body?.disasterId;

    if (!disasterId) {
      throw new ForbiddenException('error.noPermission');
    }

    await this.disasterService.findOne(disasterId);

    const isAdmin = await this.disasterMembershipService.isDisasterAdmin(
      disasterId,
      user.id,
    );
    if (!isAdmin) {
      throw new ForbiddenException('error.noPermission');
    }

    return true;
  }
}
