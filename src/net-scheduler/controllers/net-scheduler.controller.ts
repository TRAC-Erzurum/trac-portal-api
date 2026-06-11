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
} from '@nestjs/common';
import { NetSchedulerService } from '../services/net-scheduler.service';
import { CreateNetSchedulerDto } from '../dto/create-net-scheduler.dto';
import { UpdateNetSchedulerDto } from '../dto/update-net-scheduler.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole, BranchRole } from '../../auth/enums/role.enum';
import { RequestWithUser } from '../../shared/types/request.types';

@Controller('net-schedulers')
export class NetSchedulerController {
  constructor(private readonly netSchedulerService: NetSchedulerService) {}

  @Post()
  @Roles(BranchRole.MEMBER)
  create(@Body() dto: CreateNetSchedulerDto, @Req() req: RequestWithUser) {
    return this.netSchedulerService.create(dto, req.user.email, req.user.id);
  }

  @Get()
  @Roles(BranchRole.MEMBER)
  findAll(
    @Query('branchId') branchId: string | undefined,
    @Query('branchFilter')
    branchFilter: 'all' | 'my-branches' | 'branch' | undefined,
    @Query('search') search: string | undefined,
    @Query('limit') limitStr: string | undefined,
    @Query('offset') offsetStr: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    const limit = limitStr != null ? parseInt(limitStr, 10) : undefined;
    const offset = offsetStr != null ? parseInt(offsetStr, 10) : undefined;
    return this.netSchedulerService.findAll({
      branchId,
      branchFilter,
      userId: req.user.id,
      search: search?.trim() || undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
  }

  @Get(':id')
  @Roles(BranchRole.MEMBER)
  findOne(@Param('id') id: string) {
    return this.netSchedulerService.findOne(id);
  }

  @Get(':id/upcoming-nets')
  @Roles(BranchRole.MEMBER)
  getUpcomingNets(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('locale') locale?: string,
  ) {
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 3, 20) : 3;
    return this.netSchedulerService.getUpcomingNets(
      id,
      limitNum,
      locale ?? 'tr',
    );
  }

  @Patch(':id')
  @Roles(BranchRole.MEMBER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNetSchedulerDto,
    @Req() req: RequestWithUser,
  ) {
    return this.netSchedulerService.update(
      id,
      dto,
      req.user.email,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles(BranchRole.MEMBER)
  delete(@Param('id') id: string) {
    return this.netSchedulerService.delete(id);
  }
}
