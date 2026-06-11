import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../user/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';
import { InsightsService } from './insights.service';
import {
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
} from '../dashboard/services/dashboard.service';

@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('nets/personal')
  async getPersonalNetStats(
    @CurrentUser() user: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
  ): Promise<PersonalNetStats | PersonalNetStatsBranchAware> {
    return this.insightsService.getPersonalNetStats(
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
    return this.insightsService.getCommunityStats(
      user?.id,
      branchFilter ?? 'all',
      branchId,
      p,
    );
  }

  @Get('personal/last-nets')
  async getPersonalLastNets(
    @CurrentUser() user: User,
  ): Promise<PersonalLastNetsResponse> {
    return this.insightsService.getPersonalLastNets(user.id);
  }

  @Get('stats/top-streak')
  @Public()
  async getTopStreak(
    @CurrentUser() user?: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
  ): Promise<TopStreakEntry[]> {
    const branchIds = await this.insightsService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    if (branchIds && branchIds.length === 0) return [];
    return this.insightsService.getTopStreak(branchIds);
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
    const branchIds = await this.insightsService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    return this.insightsService.getParticipation(p, branchIds);
  }

  @Get('personal/trend')
  async getPersonalTrend(
    @CurrentUser() user: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
  ): Promise<PersonalTrendResponse> {
    return this.insightsService.getPersonalTrend(
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
    const branchIds = await this.insightsService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    return this.insightsService.getBusiestTime(branchIds);
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
    const branchIds = await this.insightsService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    return this.insightsService.getGeography(m, branchIds);
  }

  @Get('stats/monthly-trend')
  @Public()
  async getMonthlyTrend(
    @CurrentUser() user?: User,
    @Query('branchFilter') branchFilter?: StatsScope,
    @Query('branchId') branchId?: string,
    @Query('months', new DefaultValuePipe(12), ParseIntPipe) months?: number,
  ): Promise<MonthlyTrendEntry[]> {
    const branchIds = await this.insightsService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    return this.insightsService.getMonthlyTrend(
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
    const branchIds = await this.insightsService.resolveBranchIdsForScope(
      user?.id,
      branchFilter ?? 'all',
      branchId,
    );
    return this.insightsService.getNetsAttendeesTrend(
      Math.min(Math.max(limit, 1), 50),
      branchIds,
    );
  }

  @Get('net/:netId/compare-previous')
  @Public()
  async getNetComparePrevious(
    @Param('netId') netId: string,
  ): Promise<NetComparePreviousResponse | null> {
    return this.insightsService.getNetComparePrevious(netId);
  }
}
