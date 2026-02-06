import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MANAGE_NET_KEY } from '../decorators/manage-net.decorator';
import { ICurrentUser } from '../../user/types/user.types';
import { UserService } from '../../user/services/user.service';
import { NetService } from '../services/net.service';
import { Role } from '../../auth/enums/role.enum';
import { MembershipService } from '../../branch/services/membership.service';
import { MembershipStatus } from '../../branch/enums/membership-status.enum';
import { BranchRole } from '../../branch/enums/branch-role.enum';

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

    // SUPER_ADMIN can manage all nets
    const effectiveRole = await this.userService.getEffectiveRole(user.id);
    if (effectiveRole === Role.SUPER_ADMIN) {
      return true;
    }

    // Check if user is the net operator
    if (net.operator.user && net.operator.user.id === user.id) {
      return true;
    }

    // Check branch membership - user must be MEMBER+ in the net's branch
    const membership = await this.membershipService.findMembership(
      user.id,
      net.branchId,
    );

    if (!membership || membership.status !== MembershipStatus.APPROVED) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    // Branch ADMIN can manage all nets in their branch
    if (membership.role === BranchRole.ADMIN) {
      return true;
    }

    // For other operations, only the operator can manage (already checked above)
    throw new ForbiddenException('error.forbiddenDescription');
  }
}
