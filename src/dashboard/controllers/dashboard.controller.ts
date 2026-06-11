import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  BusiestTimeResponse,
  GeographyCountMode,
  GeographyStatsResponse,
  MonthlyTrendEntry,
  NetComparePreviousResponse,
  NetsAttendeesTrendEntry,
  StatsScope,
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
    return this.dashboardService.getRecentCompletedNets(
      Math.min(limit, 10),
      user.id,
    );
  }

  @Get('nets/cancelled')
  async getCancelledNets(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ): Promise<PendingNet[]> {
    return this.dashboardService.getRecentCancelledNets(
      Math.min(limit, 10),
      user.id,
    );
  }

  @Get('nets/personal')
  async getPersonalNetStats(
    @CurrentUser() user: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
  ): Promise<PersonalNetStats | PersonalNetStatsBranchAware> {
    return this.dashboardService.getPersonalNetStats(
      user.id,
      branchFilter ?? 'all',
      branchId,
    );
  }

  @Get('community')
  @Public()
  async getCommunityStats(
    @CurrentUser() user?: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
    @Query('period', new DefaultValuePipe('all')) period?: ParticipationPeriod,
  ): Promise<CommunityStats | CommunityStatsBranchAware> {
    const valid: ParticipationPeriod[] = ['all', '7d', '30d'];
    const p = period && valid.includes(period) ? period : 'all';
    return this.dashboardService.getCommunityStats(
      user?.id,
      branchFilter ?? 'all',
      branchId,
      p,
    );
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
    @CurrentUser() user?: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
  ): Promise<TopStreakEntry[]> {
    const branchIds = await this.dashboardService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    if (branchIds && branchIds.length === 0) return [];
    return this.dashboardService.getTopStreak(branchIds);
  }

  @Get('stats/participation')
  @Public()
  async getParticipation(
    @CurrentUser() user?: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
    @Query('period', new DefaultValuePipe('all')) period?: ParticipationPeriod,
  ): Promise<ParticipationStatsResponse> {
    const valid: ParticipationPeriod[] = ['all', '7d', '30d'];
    const p = valid.includes(period) ? period : 'all';
    const branchIds = await this.dashboardService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    return this.dashboardService.getParticipation(p, branchIds);
  }

  @Get('personal/trend')
  async getPersonalTrend(
    @CurrentUser() user: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
  ): Promise<PersonalTrendResponse> {
    return this.dashboardService.getPersonalTrend(
      user.id,
      branchFilter ?? 'all',
      branchId,
    );
  }

  @Get('stats/busiest-time')
  @Public()
  async getBusiestTime(
    @CurrentUser() user?: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
  ): Promise<BusiestTimeResponse> {
    const branchIds = await this.dashboardService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    return this.dashboardService.getBusiestTime(branchIds);
  }

  @Get('stats/geography')
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async getGeography(
    @CurrentUser() user?: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
    @Query('mode', new DefaultValuePipe('unique')) mode?: string,
  ): Promise<GeographyStatsResponse> {
    const valid: GeographyCountMode[] = ['total', 'unique'];
    const m = valid.includes(mode as GeographyCountMode)
      ? (mode as GeographyCountMode)
      : 'unique';
    const branchIds = await this.dashboardService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    return this.dashboardService.getGeography(m, branchIds);
  }

  @Get('stats/monthly-trend')
  @Public()
  async getMonthlyTrend(
    @CurrentUser() user?: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
    @Query('months', new DefaultValuePipe(12), ParseIntPipe) months?: number,
  ): Promise<MonthlyTrendEntry[]> {
    const branchIds = await this.dashboardService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    return this.dashboardService.getMonthlyTrend(
      Math.min(Math.max(months, 1), 24),
      branchIds,
    );
  }

  @Get('stats/nets-attendees-trend')
  @Public()
  async getNetsAttendeesTrend(
    @CurrentUser() user?: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit?: number,
  ): Promise<NetsAttendeesTrendEntry[]> {
    const branchIds = await this.dashboardService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    return this.dashboardService.getNetsAttendeesTrend(
      Math.min(Math.max(limit, 1), 50),
      branchIds,
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
