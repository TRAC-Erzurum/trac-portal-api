import { Injectable } from '@nestjs/common';
import {
  DashboardService,
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

@Injectable()
export class InsightsService {
  constructor(private readonly dashboardService: DashboardService) {}

  resolveBranchIdsForScope(userId: string | undefined, scope: StatsScope, branchId?: string) {
    return this.dashboardService.resolveBranchIdsForScope(userId, scope, branchId)
  }

  getPersonalNetStats(
    userId: string,
    scope: StatsScope,
    branchId?: string,
  ): Promise<PersonalNetStats | PersonalNetStatsBranchAware> {
    return this.dashboardService.getPersonalNetStats(userId, scope, branchId)
  }

  getCommunityStats(
    userId: string | undefined,
    scope: StatsScope,
    branchId: string | undefined,
    period: ParticipationPeriod,
  ): Promise<CommunityStats | CommunityStatsBranchAware> {
    return this.dashboardService.getCommunityStats(userId, scope, branchId, period)
  }

  getPersonalLastNets(userId: string): Promise<PersonalLastNetsResponse> {
    return this.dashboardService.getPersonalLastNets(userId)
  }

  getTopStreak(branchIds: string[] | null): Promise<TopStreakEntry[]> {
    return this.dashboardService.getTopStreak(branchIds)
  }

  getParticipation(period: ParticipationPeriod, branchIds: string[] | null): Promise<ParticipationStatsResponse> {
    return this.dashboardService.getParticipation(period, branchIds)
  }

  getPersonalTrend(userId: string, scope: StatsScope, branchId?: string): Promise<PersonalTrendResponse> {
    return this.dashboardService.getPersonalTrend(userId, scope, branchId)
  }

  getBusiestTime(branchIds: string[] | null): Promise<BusiestTimeResponse> {
    return this.dashboardService.getBusiestTime(branchIds)
  }

  getGeography(mode: GeographyCountMode, branchIds: string[] | null): Promise<GeographyStatsResponse> {
    return this.dashboardService.getGeography(mode, branchIds)
  }

  getMonthlyTrend(months: number, branchIds: string[] | null): Promise<MonthlyTrendEntry[]> {
    return this.dashboardService.getMonthlyTrend(months, branchIds)
  }

  getNetsAttendeesTrend(limit: number, branchIds: string[] | null): Promise<NetsAttendeesTrendEntry[]> {
    return this.dashboardService.getNetsAttendeesTrend(limit, branchIds)
  }

  getNetComparePrevious(netId: string): Promise<NetComparePreviousResponse | null> {
    return this.dashboardService.getNetComparePrevious(netId)
  }
}