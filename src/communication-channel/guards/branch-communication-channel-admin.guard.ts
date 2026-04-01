import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalRole } from '../../auth/enums/role.enum';
import { isApprovedBranchLeadership } from '../../branch/utils/is-approved-branch-leadership.util';
import { MembershipService } from '../../branch/services/membership.service';
import { MembershipStatus } from '../../branch/enums/membership-status.enum';
import { BranchCommunicationChannel } from '../entities/branch-communication-channel.entity';

/**
 * Süper admin veya kanalın bağlı olduğu şubede onaylı şube yöneticisi / başkan.
 * `params.id` = iletişim kanalı kimliği.
 */
@Injectable()
export class BranchCommunicationChannelAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(BranchCommunicationChannel)
    private readonly channelRepository: Repository<BranchCommunicationChannel>,
    private readonly membershipService: MembershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    if (user.role === GlobalRole.SUPER_ADMIN) {
      return true;
    }

    const channelId = request.params?.id;
    if (!channelId) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    const channel = await this.channelRepository.findOne({
      where: { id: String(channelId) },
      select: ['id', 'branchId'],
    });
    if (!channel) {
      throw new NotFoundException('error.communicationChannelNotFound');
    }

    const membership = await this.membershipService.findMembership(
      String(user.id),
      channel.branchId,
    );
    if (
      !membership ||
      membership.status !== MembershipStatus.APPROVED ||
      !isApprovedBranchLeadership(membership)
    ) {
      throw new ForbiddenException('error.forbiddenDescription');
    }

    return true;
  }
}
