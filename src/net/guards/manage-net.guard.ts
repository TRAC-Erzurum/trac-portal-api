import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  MANAGE_NET_KEY,
  MANAGE_NET_DELETE_LEADERSHIP_ONLY_KEY,
} from '../decorators/manage-net.decorator';
import { ICurrentUser } from '../../user/types/user.types';
import { UserService } from '../../user/services/user.service';
import { NetService } from '../services/net.service';
import { GlobalRole } from '../../auth/enums/role.enum';
import { MembershipService } from '../../branch/services/membership.service';
import { MembershipStatus } from '../../branch/enums/membership-status.enum';

@Injectable()
export class ManageNetGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private netService: NetService,
    private userService: UserService,
    private membershipService: MembershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName = this.reflector.get<string>(
      MANAGE_NET_KEY,
      context.getHandler(),
    );

    if (!paramName) {
      return true;
    }

    const deleteLeadershipOnly = this.reflector.getAllAndOverride<boolean>(
      MANAGE_NET_DELETE_LEADERSHIP_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const netId: string = request.params[paramName];
    const user: ICurrentUser = request.user;

    if (!netId || !user) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    const net = await this.netService.findOne(netId);

    if (!net) {
      throw new NotFoundException('Çevrim bulunamadı');
    }

    const effectiveRole = await this.userService.getEffectiveRole(user.id);
    if (effectiveRole === GlobalRole.SUPER_ADMIN) {
      return true;
    }

    const canLeadBranch = await this.membershipService.canActAsBranchLeaderOnBranch(
      user.id,
      net.branchId,
    );
    if (canLeadBranch) {
      return true;
    }

    const membership = await this.membershipService.findMembership(
      user.id,
      net.branchId,
    );

    if (deleteLeadershipOnly) {
      throw new ForbiddenException('error.noPermission');
    }

    if (net.operator.user && net.operator.user.id === user.id) {
      return true;
    }

    if (!membership || membership.status !== MembershipStatus.APPROVED) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    throw new ForbiddenException('error.forbiddenDescription');
  }
}
