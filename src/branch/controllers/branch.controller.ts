import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BranchService } from '../services/branch.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { UpdateStatusDto } from '../dto/update-status.dto';
import { DeleteBranchDto } from '../dto/delete-branch.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole, BranchRole } from '../../auth/enums/role.enum';
import { RequestWithUser } from '../../shared/types/request.types';
import { BranchAdminGuard } from '../guards/branch-admin.guard';
import { CreateBranchGuard } from '../guards/create-branch.guard';

@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  @Roles(GlobalRole.GUEST)
  @UseGuards(CreateBranchGuard)
  async create(
    @Body() createBranchDto: CreateBranchDto,
    @Req() req: RequestWithUser,
  ) {
    return this.branchService.create(
      createBranchDto,
      req.user.id,
      req.user.callSign || '',
    );
  }

  @Get('admin/inactive-branches')
  @Roles(GlobalRole.SUPER_ADMIN)
  async findInactive() {
    return this.branchService.findInactive();
  }

  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query('includeInactive') includeInactive?: string,
    @Query('search') search?: string,
    @Query('pageNumber') pageNumber?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const options: {
      includeInactive?: boolean;
      search?: string;
      pageNumber?: number;
      pageSize?: number;
    } = {};

    // Only SUPER_ADMIN can use includeInactive
    if (
      includeInactive === 'true' &&
      req.user.role === GlobalRole.SUPER_ADMIN
    ) {
      options.includeInactive = true;
    }

    if (search) {
      options.search = search;
    }

    if (pageNumber) {
      options.pageNumber = parseInt(pageNumber, 10);
    }

    if (pageSize) {
      options.pageSize = parseInt(pageSize, 10);
    }

    return this.branchService.findAll(options);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.branchService.findOne(id);
  }

  @Delete(':id')
  @Roles(GlobalRole.SUPER_ADMIN)
  async delete(
    @Param('id') id: string,
    @Body() deleteBranchDto: DeleteBranchDto,
  ) {
    await this.branchService.delete(id, deleteBranchDto);
  }

  @Patch(':id')
  @UseGuards(BranchAdminGuard)
  async update(
    @Param('id') id: string,
    @Body() updateBranchDto: UpdateBranchDto,
    @Req() req: RequestWithUser,
  ) {
    return this.branchService.update(id, updateBranchDto, req.user.id);
  }

  @Patch(':id/status')
  @Roles(GlobalRole.SUPER_ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
    @Req() req: RequestWithUser,
  ) {
    if (updateStatusDto.isActive) {
      return this.branchService.activate(
        id,
        req.user.id,
        req.user.callSign || '',
      );
    } else {
      return this.branchService.deactivate(
        id,
        req.user.id,
        req.user.callSign || '',
      );
    }
  }

  @Get(':id/nets')
  async getBranchNets(
    @Param('id') id: string,
    @Query('search') search: string | undefined,
    @Query('status') status: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @Query('offset') offsetStr: string | undefined,
  ) {
    const limit = limitStr != null ? parseInt(limitStr, 10) : undefined;
    const offset = offsetStr != null ? parseInt(offsetStr, 10) : undefined;
    return this.branchService.getBranchNets(id, {
      search: search?.trim() || undefined,
      status:
        status === 'active' ||
        status === 'pending' ||
        status === 'completed' ||
        status === 'cancelled'
          ? status
          : undefined,
      limit: Number.isFinite(limit) ? Math.min(limit, 100) : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
  }
}
