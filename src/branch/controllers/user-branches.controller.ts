import { Controller, Get, Param } from '@nestjs/common';
import { MembershipService } from '../services/membership.service';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { ICurrentUser } from '../../user/types/user.types';

@Controller('users')
export class UserBranchesController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('me/branches')
  async getUserBranches(@CurrentUser() user: ICurrentUser) {
    return this.membershipService.getUserBranches(user.id);
  }

  @Get('me/memberships')
  async getMyMemberships(@CurrentUser() user: ICurrentUser) {
    return this.membershipService.getUserMemberships(user.id);
  }

  @Get(':userId/memberships')
  async getUserMemberships(@Param('userId') userId: string) {
    return this.membershipService.getUserMemberships(userId);
  }
}
