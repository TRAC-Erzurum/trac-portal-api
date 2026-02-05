import { Controller, Get } from '@nestjs/common';
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
}
