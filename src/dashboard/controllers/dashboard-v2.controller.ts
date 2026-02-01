import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { User } from '../../user/entities/user.entity';
import { Public } from '../../auth/decorators/public.decorator';
import {
  DashboardV2Service,
  StatusResponse,
  ActiveNet,
  PendingNet,
  PersonalNetStats,
  CommunityStats,
} from '../services/dashboard-v2.service';

@Controller('v2/dashboard')
export class DashboardV2Controller {
  constructor(private readonly dashboardService: DashboardV2Service) {}

  @Get('status')
  async getStatus(@CurrentUser() user: User): Promise<StatusResponse> {
    return this.dashboardService.getStatus();
  }

  @Get('nets/active')
  async getActiveNets(
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ): Promise<ActiveNet[]> {
    return this.dashboardService.getActiveNets(Math.min(limit, 10));
  }

  @Get('nets/pending')
  async getPendingNets(
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ): Promise<PendingNet[]> {
    return this.dashboardService.getPendingNets(Math.min(limit, 10));
  }

  @Get('nets/recent')
  async getRecentNets(
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ): Promise<ActiveNet[]> {
    return this.dashboardService.getRecentCompletedNets(Math.min(limit, 10));
  }

  @Get('nets/personal')
  async getPersonalNetStats(@CurrentUser() user: User): Promise<PersonalNetStats> {
    return this.dashboardService.getPersonalNetStats(user.id);
  }

  @Get('community')
  @Public()
  async getCommunityStats(): Promise<CommunityStats> {
    return this.dashboardService.getCommunityStats();
  }

  @Get('activity')
  async getActivity(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.dashboardService.getActivity(user?.id, Math.min(limit, 50), offset);
  }

  @Get('activity/global')
  @Public()
  async getGlobalActivity(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.dashboardService.getActivity(undefined, Math.min(limit, 50), offset);
  }
}
