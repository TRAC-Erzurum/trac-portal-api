import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { User } from '../../user/entities/user.entity';
import { Public } from '../../auth/decorators/public.decorator';
import {
  DashboardService,
  StatusResponse,
  ActiveNet,
  PendingNet,
  PersonalNetStats,
  PersonalNetStatsBranchAware,
  CommunityStats,
  CommunityStatsBranchAware,
  PersonalLastNetsResponse,
  TopStreakEntry,
  ParticipationPeriod,
  ParticipationStatsResponse,
  PersonalTrendResponse,
  ActivitySummaryPeriod,
  ActivitySummaryResponse,
  BusiestTimeResponse,
  GeographyStatsResponse,
  MonthlyTrendEntry,
  NetComparePreviousResponse,
  NetsAttendeesTrendEntry,
} from '../services/dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('status')
  async getStatus(@CurrentUser() _user: User): Promise<StatusResponse> {
    return this.dashboardService.getStatus();
  }

  @Get('nets/active')
  async getActiveNets(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ): Promise<ActiveNet[]> {
    return this.dashboardService.getActiveNets(Math.min(limit, 10), user.id);
  }

  @Get('nets/pending')
  async getPendingNets(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ): Promise<PendingNet[]> {
    return this.dashboardService.getPendingNets(Math.min(limit, 10), user.id);
  }

  @Get('nets/recent')
  async getRecentNets(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ): Promise<ActiveNet[]> {
    return this.dashboardService.getRecentCompletedNets(Math.min(limit, 10), user.id);
  }

  @Get('nets/personal')
  async getPersonalNetStats(
    @CurrentUser() user: User,
    @Query('branchId') branchId?: string,
  ): Promise<PersonalNetStats | PersonalNetStatsBranchAware> {
    return this.dashboardService.getPersonalNetStats(user.id, branchId);
  }

  @Get('community')
  @Public()
  async getCommunityStats(
    @Query('branchId') branchId?: string,
    @Query('period', new DefaultValuePipe('all')) period?: ParticipationPeriod,
  ): Promise<CommunityStats | CommunityStatsBranchAware> {
    const valid: ParticipationPeriod[] = ['all', '7d', '30d'];
    const p = period && valid.includes(period) ? period : 'all';
    return this.dashboardService.getCommunityStats(branchId, p);
  }

  @Get('activity')
  async getActivity(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.dashboardService.getActivity(
      user?.id,
      Math.min(limit, 50),
      offset,
    );
  }

  @Get('activity/global')
  @Public()
  async getGlobalActivity(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.dashboardService.getActivity(
      undefined,
      Math.min(limit, 50),
      offset,
    );
  }

  @Get('personal/last-nets')
  async getPersonalLastNets(
    @CurrentUser() user: User,
  ): Promise<PersonalLastNetsResponse> {
    return this.dashboardService.getPersonalLastNets(user.id);
  }

  @Get('stats/top-streak')
  @Public()
  async getTopStreak(
    @Query('branchId') branchId?: string,
  ): Promise<TopStreakEntry[]> {
    if (!branchId) return [];
    return this.dashboardService.getTopStreakByBranch(branchId);
  }

  @Get('stats/participation')
  @Public()
  async getParticipation(
    @Query('period', new DefaultValuePipe('all')) period: ParticipationPeriod,
  ): Promise<ParticipationStatsResponse> {
    const valid: ParticipationPeriod[] = ['all', '7d', '30d'];
    const p = valid.includes(period) ? period : 'all';
    return this.dashboardService.getParticipation(p);
  }

  @Get('personal/trend')
  async getPersonalTrend(
    @CurrentUser() user: User,
    @Query('branchId') branchId?: string,
  ): Promise<PersonalTrendResponse> {
    return this.dashboardService.getPersonalTrend(user.id, branchId);
  }

  @Get('stats/activity-summary')
  @Public()
  async getActivitySummary(
    @Query('period', new DefaultValuePipe('7d')) period: ActivitySummaryPeriod,
  ): Promise<ActivitySummaryResponse> {
    const valid: ActivitySummaryPeriod[] = ['all', '7d', '30d'];
    const p = valid.includes(period) ? period : '7d';
    return this.dashboardService.getActivitySummary(p);
  }

  @Get('stats/busiest-time')
  @Public()
  async getBusiestTime(): Promise<BusiestTimeResponse> {
    return this.dashboardService.getBusiestTime();
  }

  @Get('stats/geography')
  @Public()
  async getGeography(): Promise<GeographyStatsResponse> {
    return this.dashboardService.getGeography();
  }

  @Get('stats/monthly-trend')
  @Public()
  async getMonthlyTrend(
    @Query('months', new DefaultValuePipe(12), ParseIntPipe) months: number,
  ): Promise<MonthlyTrendEntry[]> {
    return this.dashboardService.getMonthlyTrend(Math.min(Math.max(months, 1), 24));
  }

  @Get('stats/nets-attendees-trend')
  @Public()
  async getNetsAttendeesTrend(
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('branchId') branchId?: string,
  ): Promise<NetsAttendeesTrendEntry[]> {
    return this.dashboardService.getNetsAttendeesTrend(
      Math.min(Math.max(limit, 1), 50),
      branchId,
    );
  }

  @Get('net/:netId/compare-previous')
  @Public()
  async getNetComparePrevious(
    @Param('netId') netId: string,
  ): Promise<NetComparePreviousResponse | null> {
    return this.dashboardService.getNetComparePrevious(netId);
  }
}
