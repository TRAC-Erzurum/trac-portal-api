import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { MembershipService } from '../services/membership.service';
import { RequestWithUser } from '../../shared/types/request.types';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { ICurrentUser } from '../../user/types/user.types';
import { BranchAdminGuard } from '../guards/branch-admin.guard';
import { BranchMemberGuard } from '../guards/branch-member.guard';
import { ApproveMembershipDto } from '../dto/approve-membership.dto';
import { RejectMembershipDto } from '../dto/reject-membership.dto';
import { UpdateMembershipRoleDto } from '../dto/update-membership-role.dto';
import { AddMemberDto } from '../dto/add-member.dto';
import { BranchRole } from '../enums/branch-role.enum';

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

  @Post(':branchId/members/add')
  @UseGuards(BranchAdminGuard)
  async addMember(
    @Param('branchId') branchId: string,
    @Body() dto: AddMemberDto,
    @Req() req: RequestWithUser,
  ) {
    return this.membershipService.addMemberDirectly(
      branchId,
      dto.operatorId,
      dto.role ?? BranchRole.MEMBER,
      req.user.id,
      req.user.callSign || '',
    );
  }

  @Get(':branchId/pending-requests')
  @UseGuards(BranchAdminGuard)
  async getPendingRequests(@Param('branchId') branchId: string) {
    return this.membershipService.getPendingMembershipsByBranch(branchId);
  }

  @Patch(':branchId/members/:membershipId/approve')
  @UseGuards(BranchAdminGuard)
  async approve(
    @Param('branchId') branchId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: ApproveMembershipDto,
    @Req() req: RequestWithUser,
  ) {
    return this.membershipService.approve(
      membershipId,
      req.user.id,
      req.user.callSign || '',
      dto.role ?? BranchRole.MEMBER,
      branchId,
    );
  }

  @Patch(':branchId/members/:membershipId/reject')
  @UseGuards(BranchAdminGuard)
  async reject(
    @Param('branchId') branchId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: RejectMembershipDto,
    @Req() req: RequestWithUser,
  ) {
    return this.membershipService.reject(
      membershipId,
      req.user.id,
      req.user.callSign || '',
      dto.rejectionReason,
      branchId,
    );
  }

  @Patch(':branchId/members/:membershipId/role')
  @UseGuards(BranchAdminGuard)
  async updateRole(
    @Param('branchId') branchId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipRoleDto,
    @Req() req: RequestWithUser,
  ) {
    return this.membershipService.updateRole(
      membershipId,
      dto.role,
      req.user.id,
      req.user.callSign || '',
      branchId,
    );
  }

  @Delete(':branchId/members/:operatorId')
  @UseGuards(BranchAdminGuard)
  async remove(
    @Param('branchId') branchId: string,
    @Param('operatorId') operatorId: string,
    @Req() req: RequestWithUser,
  ) {
    await this.membershipService.remove(
      operatorId,
      branchId,
      req.user.id,
      req.user.callSign || '',
      req.user.role,
    );
    return { success: true };
  }

  @Get(':branchId/members')
  @UseGuards(BranchMemberGuard)
  async getMembers(
    @Param('branchId') branchId: string,
    @Query('pageNumber') pageNumber?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Req() req?: RequestWithUser,
  ) {
    const page = pageNumber ? parseInt(pageNumber, 10) : undefined;
    const size = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.membershipService.getMembersByBranch(
      branchId,
      page,
      size,
      search,
      role,
      req?.user?.id,
    );
  }
}
