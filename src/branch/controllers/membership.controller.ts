import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { MembershipService } from '../services/membership.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { RequestWithUser } from '../../shared/types/request.types';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { ICurrentUser } from '../../user/types/user.types';

@Controller('branches')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Post(':branchId/members')
  async join(
    @Param('branchId') branchId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.membershipService.join(user.id, branchId);
  }

  @Patch(':branchId/members/:userId/approve')
  @Roles(Role.SUPER_ADMIN)
  async approve(
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @Req() req: RequestWithUser,
  ) {
    const membership = await this.membershipService.findMembership(userId, branchId);
    if (!membership) {
      throw new NotFoundException('error.membershipNotFound');
    }
    return this.membershipService.approve(
      membership.id,
      req.user.id,
      req.user.callSign || '',
    );
  }

  @Patch(':branchId/members/:userId/reject')
  @Roles(Role.SUPER_ADMIN)
  async reject(
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @Req() req: RequestWithUser,
  ) {
    const membership = await this.membershipService.findMembership(userId, branchId);
    if (!membership) {
      throw new NotFoundException('error.membershipNotFound');
    }
    return this.membershipService.reject(
      membership.id,
      req.user.id,
      req.user.callSign || '',
    );
  }

  @Delete(':branchId/members/:userId')
  @Roles(Role.SUPER_ADMIN)
  async remove(
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @Req() req: RequestWithUser,
  ) {
    await this.membershipService.remove(
      userId,
      branchId,
      req.user.id,
      req.user.callSign || '',
    );
    return { success: true };
  }

  @Get(':branchId/members')
  async getMembers(@Param('branchId') branchId: string) {
    return this.membershipService.getMembersByBranch(branchId);
  }

  @Get('users/me/branches')
  async getUserBranches(@CurrentUser() user: ICurrentUser) {
    return this.membershipService.getUserBranches(user.id);
  }
}
