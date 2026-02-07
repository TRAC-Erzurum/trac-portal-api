import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Net } from '../../net/entities/net.entity';
import { Attendee } from '../../net/entities/attendee.entity';
import { Operator } from '../../operator/entities/operator.entity';
import { Activity } from '../../activity/entities/activity.entity';
import { UserBranchMembership } from '../../branch/entities/user-branch-membership.entity';
import { MembershipStatus } from '../../branch/enums/membership-status.enum';

export interface StatusResponse {
  activeNetsCount: number;
  hasActiveNets: boolean;
}

export interface ActiveNet {
  id: string;
  name: string;
  operatorCallSign: string;
  attendeeCount: number;
  startedAt: Date;
  durationMinutes: number;
  branch?: {
    id: string;
    name: string;
    isHeadquarters?: boolean;
  };
  branchCallSign?: {
    id: string;
    callSign: string;
  };
}

export interface PendingNet {
  id: string;
  name: string;
  operatorCallSign: string;
  branch?: {
    id: string;
    name: string;
    isHeadquarters?: boolean;
  };
  branchCallSign?: {
    id: string;
    callSign: string;
  };
}

export interface PersonalNetStats {
  attendedNets: number;
  managedNets: number;
  streak: number;
}

export interface PersonalNetStatsBranchAware {
  branch: {
    participatedNets: number;
    managedNets: number;
    currentStreak: number;
  };
  global: {
    totalParticipatedNets: number;
    totalManagedNets: number;
    longestStreak: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  callSign: string;
  operatorId?: string | null;
  netId?: string | null;
  picture?: string | null;
  value: number;
  label: string;
}

export interface MonthlyStats {
  month: string;
  year: number;
  monthIndex: number;
  netsCount: number;
  totalAttendees: number;
  uniqueParticipants: number;
}

export interface CommunityStats {
  totalUniqueParticipants: number;
  totalCompletedNets: number;
  totalAttendees: number;
  monthlyStats: MonthlyStats[];
  topParticipants: LeaderboardEntry[];
  topNetManagers: LeaderboardEntry[];
  topNets: LeaderboardEntry[];
}

export interface CommunityStatsBranchAware {
  branch: {
    totalNets: number;
    totalAttendees: number;
    totalUniqueParticipants: number;
    topOperators: LeaderboardEntry[];
    topNets: LeaderboardEntry[];
    topParticipants: LeaderboardEntry[];
  };
  global: {
    totalUniqueParticipants: number;
    totalCompletedNets: number;
    monthlyStats: MonthlyStats[];
    topParticipants: LeaderboardEntry[];
    topNetManagers: LeaderboardEntry[];
    topNets: LeaderboardEntry[];
  };
}

export interface LastNetInfo {
  id: string;
  name: string;
  date: string;
  netId?: string;
}

export interface PersonalLastNetsResponse {
  lastAttended: LastNetInfo | null;
  lastManaged: LastNetInfo | null;
}

export interface TopStreakEntry {
  rank: number;
  callSign: string;
  operatorId: string | null;
  value: number;
}

export type ParticipationPeriod = 'all' | '7d' | '30d';

export interface ParticipationStatsResponse {
  period: ParticipationPeriod;
  completedNets: number;
  uniqueParticipants: number;
  avgUniqueParticipantsPerNet: number;
}

export interface PersonalTrendResponse {
  thisMonthParticipated: number;
  lastMonthParticipated: number;
  thisMonthManaged: number;
  lastMonthManaged: number;
}

export type ActivitySummaryPeriod = 'all' | '7d' | '30d';

export interface ActivitySummaryResponse {
  period: ActivitySummaryPeriod;
  netsStarted: number;
  netsEnded: number;
  attendeesAdded: number;
}

export interface BusiestTimeResponse {
  byDay: { dayOfWeek: number; count: number }[];
  byHour: { hour: number; count: number }[];
}

export interface GeographyStatsResponse {
  countries: { country: string; count: number }[];
  cities: { city: string; count: number }[];
  districts: { city: string; district: string; count: number }[];
}

export interface MonthlyTrendEntry {
  month: string;
  year: number;
  monthIndex: number;
  completedNets: number;
  uniqueParticipants: number;
}

export interface NetComparePreviousResponse {
  previousAttendeeCount: number;
  previousDurationMinutes: number;
  deltaAttendeeCount: number;
  deltaDurationMinutes: number;
  previousEndedAt: string;
}

export interface NetsAttendeesTrendEntry {
  endedAt: string;
  attendeeCount: number;
  netName: string;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    @InjectRepository(Attendee)
    private readonly attendeeRepository: Repository<Attendee>,
    @InjectRepository(Operator)
    private readonly operatorRepository: Repository<Operator>,
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(UserBranchMembership)
    private readonly membershipRepository: Repository<UserBranchMembership>,
  ) {}

  private async getBranchIdsForUser(userId: string): Promise<string[]> {
    const memberships = await this.membershipRepository.find({
      where: { userId, status: MembershipStatus.APPROVED },
      select: ['branchId'],
    });
    return memberships.map((m) => m.branchId);
  }

  async getStatus(): Promise<StatusResponse> {
    const activeNetsCount = await this.netRepository.count({
      where: {
        startedAt: Not(IsNull()),
        endedAt: IsNull(),
      },
    });

    return {
      activeNetsCount,
      hasActiveNets: activeNetsCount > 0,
    };
  }

  async getActiveNets(limit: number = 5, userId?: string): Promise<ActiveNet[]> {
    const branchIds = userId ? await this.getBranchIdsForUser(userId) : null;
    if (branchIds !== null && branchIds.length === 0) return [];

    const qb = this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('net.branch', 'branch')
      .leftJoinAndSelect('net.branchCallSign', 'branchCallSign')
      .loadRelationCountAndMap('net.attendeeCount', 'net.attendees')
      .where('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NULL');

    if (branchIds !== null) {
      qb.andWhere('net.branchId IN (:...branchIds)', { branchIds });
    }

    const nets = await qb
      .orderBy('net.startedAt', 'DESC')
      .limit(limit)
      .getMany();

    const now = new Date();

    return nets.map((net) => ({
      id: net.id,
      name: net.name,
      operatorCallSign: net.operator?.callSign || 'Unknown',
      attendeeCount: (net as any).attendeeCount || 0,
      startedAt: net.startedAt,
      durationMinutes: net.startedAt
        ? Math.floor(
            (now.getTime() - new Date(net.startedAt).getTime()) / 60000,
          )
        : 0,
      branch: net.branch
        ? {
            id: net.branch.id,
            name: net.branch.name,
            isHeadquarters: net.branch.isHeadquarters,
          }
        : undefined,
      branchCallSign: net.branchCallSign
        ? {
            id: net.branchCallSign.id,
            callSign: net.branchCallSign.callSign,
          }
        : undefined,
    }));
  }

  async getPendingNets(limit: number = 5, userId?: string): Promise<PendingNet[]> {
    const branchIds = userId ? await this.getBranchIdsForUser(userId) : null;
    if (branchIds !== null && branchIds.length === 0) return [];

    const qb = this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('net.branch', 'branch')
      .leftJoinAndSelect('net.branchCallSign', 'branchCallSign')
      .where('net.startedAt IS NULL');

    if (branchIds !== null) {
      qb.andWhere('net.branchId IN (:...branchIds)', { branchIds });
    }

    const nets = await qb
      .orderBy('net.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return nets.map((net) => ({
      id: net.id,
      name: net.name,
      operatorCallSign: net.operator?.callSign || 'Unknown',
      branch: net.branch
        ? {
            id: net.branch.id,
            name: net.branch.name,
            isHeadquarters: net.branch.isHeadquarters,
          }
        : undefined,
      branchCallSign: net.branchCallSign
        ? {
            id: net.branchCallSign.id,
            callSign: net.branchCallSign.callSign,
          }
        : undefined,
    }));
  }

  async getRecentCompletedNets(limit: number = 3, userId?: string): Promise<ActiveNet[]> {
    const branchIds = userId ? await this.getBranchIdsForUser(userId) : null;
    if (branchIds !== null && branchIds.length === 0) return [];

    const qb = this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('net.branch', 'branch')
      .leftJoinAndSelect('net.branchCallSign', 'branchCallSign')
      .loadRelationCountAndMap('net.attendeeCount', 'net.attendees')
      .where('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL');

    if (branchIds !== null) {
      qb.andWhere('net.branchId IN (:...branchIds)', { branchIds });
    }

    const nets = await qb
      .orderBy('net.endedAt', 'DESC')
      .limit(limit)
      .getMany();

    return nets.map((net) => {
      const duration =
        net.startedAt && net.endedAt
          ? Math.floor(
              (new Date(net.endedAt).getTime() -
                new Date(net.startedAt).getTime()) /
                60000,
            )
          : 0;

      return {
        id: net.id,
        name: net.name,
        operatorCallSign: net.operator?.callSign || 'Unknown',
        attendeeCount: (net as any).attendeeCount || 0,
        startedAt: net.startedAt,
        durationMinutes: duration,
        branch: net.branch
          ? {
              id: net.branch.id,
              name: net.branch.name,
              isHeadquarters: net.branch.isHeadquarters,
            }
          : undefined,
        branchCallSign: net.branchCallSign
          ? {
              id: net.branchCallSign.id,
              callSign: net.branchCallSign.callSign,
            }
          : undefined,
      };
    });
  }

  async getPersonalNetStats(
    userId: string,
    branchId?: string,
  ): Promise<PersonalNetStats | PersonalNetStatsBranchAware> {
    const [attendedNets, managedNets, streak] = await Promise.all([
      this.attendeeRepository.count({
        where: { operator: { user: { id: userId } } },
      }),
      this.netRepository.count({
        where: { operator: { user: { id: userId } } },
      }),
      this.calculateStreak(userId),
    ]);

    if (!branchId) {
      return { attendedNets, managedNets, streak };
    }

    const [branchAttended, branchManaged, branchStreak] = await Promise.all([
      this.attendeeRepository
        .createQueryBuilder('attendee')
        .leftJoin('attendee.net', 'net')
        .leftJoin('attendee.operator', 'operator')
        .leftJoin('operator.user', 'user')
        .where('user.id = :userId', { userId })
        .andWhere('net.branchId = :branchId', { branchId })
        .andWhere('net.endedAt IS NOT NULL')
        .getCount(),
      this.netRepository.count({
        where: { operator: { user: { id: userId } }, branchId },
      }),
      this.calculateStreakForBranch(userId, branchId),
    ]);

    return {
      branch: {
        participatedNets: branchAttended,
        managedNets: branchManaged,
        currentStreak: branchStreak,
      },
      global: {
        totalParticipatedNets: attendedNets,
        totalManagedNets: managedNets,
        longestStreak: streak,
      },
    };
  }

  async getCommunityStats(
    branchId?: string,
    period: ParticipationPeriod = 'all',
  ): Promise<CommunityStats | CommunityStatsBranchAware> {
    const now = new Date();
    const last3Months = this.getLast3Months(now);

    let communityStart: Date;
    if (period === '7d') {
      communityStart = new Date(now);
      communityStart.setDate(communityStart.getDate() - 7);
      communityStart.setHours(0, 0, 0, 0);
    } else if (period === '30d') {
      communityStart = new Date(now);
      communityStart.setDate(communityStart.getDate() - 30);
      communityStart.setHours(0, 0, 0, 0);
    } else {
      communityStart = new Date(0);
    }
    const applyPeriod = period !== 'all';

    const [
      totalUniqueParticipantsResult,
      totalCompletedNetsResult,
      totalAttendeesResult,
      monthlyStatsRaw,
      topParticipantsRaw,
      topNetManagersRaw,
      topNetsRaw,
    ] = await Promise.all([
      (() => {
        const qb = this.attendeeRepository
          .createQueryBuilder('attendee')
          .innerJoin('attendee.net', 'net')
          .select('COUNT(DISTINCT UPPER(TRIM(attendee.callSign)))', 'count')
          .where('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL');
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawOne();
      })(),

      (() => {
        const qb = this.netRepository
          .createQueryBuilder('net')
          .where('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL');
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getCount();
      })(),

      (() => {
        const qb = this.attendeeRepository
          .createQueryBuilder('attendee')
          .innerJoin('attendee.net', 'net')
          .select('COUNT(attendee.id)', 'count')
          .where('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL');
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawOne();
      })(),

      this.getMonthlyStats(last3Months),

      (() => {
        const qb = this.attendeeRepository
          .createQueryBuilder('attendee')
          .innerJoin('attendee.net', 'net')
          .leftJoin('attendee.operator', 'operator')
          .leftJoin('operator.user', 'user')
          .select([
            'UPPER(TRIM(attendee.callSign)) as "callSign"',
            'operator.id as "operatorId"',
            'user.picture as "picture"',
            'COUNT(attendee.id) as value',
          ])
          .where('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL')
          .groupBy('UPPER(TRIM(attendee.callSign))')
          .addGroupBy('operator.id')
          .addGroupBy('user.picture')
          .orderBy('value', 'DESC')
          .limit(5);
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawMany();
      })(),

      (() => {
        const qb = this.netRepository
          .createQueryBuilder('net')
          .leftJoin('net.operator', 'operator')
          .leftJoin('operator.user', 'user')
          .select([
            'operator.id as "operatorId"',
            'operator.callSign as "callSign"',
            'user.picture as "picture"',
            'COUNT(net.id) as value',
          ])
          .where('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL')
          .groupBy('operator.id')
          .addGroupBy('operator.callSign')
          .addGroupBy('user.picture')
          .orderBy('value', 'DESC')
          .limit(5);
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawMany();
      })(),

      (() => {
        const qb = this.netRepository
          .createQueryBuilder('net')
          .leftJoin('net.attendees', 'attendee')
          .select([
            'net.id as "netId"',
            'net.name as name',
            'COUNT(attendee.id) as value',
          ])
          .where('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL')
          .groupBy('net.id')
          .addGroupBy('net.name')
          .orderBy('value', 'DESC')
          .limit(5);
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawMany();
      })(),
    ]);

    const topParticipants: LeaderboardEntry[] = topParticipantsRaw.map(
      (op, index) => ({
        rank: index + 1,
        callSign: op.callSign,
        operatorId: op.operatorId || null,
        picture: op.picture || null,
        value: parseInt(String(op.value), 10),
        label: 'attendance',
      }),
    );

    const topNetManagers: LeaderboardEntry[] = topNetManagersRaw.map(
      (op, index) => ({
        rank: index + 1,
        callSign: op.callSign,
        operatorId: op.operatorId || null,
        picture: op.picture || null,
        value: parseInt(String(op.value), 10),
        label: 'nets',
      }),
    );

    const topNets: LeaderboardEntry[] = topNetsRaw.map((net, index) => ({
      rank: index + 1,
      callSign: net.name,
      netId: net.netId || null,
      value: parseInt(String(net.value), 10),
      label: 'attendees',
    }));

    const globalStats: CommunityStats = {
      totalUniqueParticipants: parseInt(
        String(totalUniqueParticipantsResult?.count ?? '0'),
        10,
      ),
      totalCompletedNets: totalCompletedNetsResult,
      totalAttendees: parseInt(String(totalAttendeesResult?.count ?? '0'), 10),
      monthlyStats: monthlyStatsRaw,
      topParticipants,
      topNetManagers,
      topNets,
    };

    if (!branchId) {
      return globalStats;
    }

    const [
      branchTotalNets,
      branchTotalAttendeesResult,
      branchTotalUniqueResult,
      branchTopManagersRaw,
      branchTopNetsRaw,
      branchTopParticipantsRaw,
    ] = await Promise.all([
      (() => {
        const qb = this.netRepository
          .createQueryBuilder('net')
          .where('net.branchId = :branchId', { branchId })
          .andWhere('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL');
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getCount();
      })(),
      (() => {
        const qb = this.attendeeRepository
          .createQueryBuilder('attendee')
          .innerJoin('attendee.net', 'net')
          .select('COUNT(attendee.id)', 'count')
          .where('net.branchId = :branchId', { branchId })
          .andWhere('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL');
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawOne();
      })(),
      (() => {
        const qb = this.attendeeRepository
          .createQueryBuilder('attendee')
          .innerJoin('attendee.net', 'net')
          .select('COUNT(DISTINCT UPPER(TRIM(attendee.callSign)))', 'count')
          .where('net.branchId = :branchId', { branchId })
          .andWhere('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL');
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawOne();
      })(),
      (() => {
        const qb = this.netRepository
          .createQueryBuilder('net')
          .leftJoin('net.operator', 'operator')
          .leftJoin('operator.user', 'user')
          .select([
            'operator.id as "operatorId"',
            'operator.callSign as "callSign"',
            'user.picture as "picture"',
            'COUNT(net.id) as value',
          ])
          .where('net.branchId = :branchId', { branchId })
          .andWhere('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL')
          .groupBy('operator.id')
          .addGroupBy('operator.callSign')
          .addGroupBy('user.picture')
          .orderBy('value', 'DESC')
          .limit(5);
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawMany();
      })(),
      (() => {
        const qb = this.netRepository
          .createQueryBuilder('net')
          .leftJoin('net.attendees', 'attendee')
          .select([
            'net.id as "netId"',
            'net.name as name',
            'COUNT(attendee.id) as value',
          ])
          .where('net.branchId = :branchId', { branchId })
          .andWhere('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL')
          .groupBy('net.id')
          .addGroupBy('net.name')
          .orderBy('value', 'DESC')
          .limit(5);
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawMany();
      })(),
      (() => {
        const qb = this.attendeeRepository
          .createQueryBuilder('attendee')
          .innerJoin('attendee.net', 'net')
          .leftJoin('attendee.operator', 'operator')
          .leftJoin('operator.user', 'user')
          .select([
            'UPPER(TRIM(attendee.callSign)) as "callSign"',
            'operator.id as "operatorId"',
            'user.picture as "picture"',
            'COUNT(attendee.id) as value',
          ])
          .where('net.branchId = :branchId', { branchId })
          .andWhere('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL')
          .groupBy('UPPER(TRIM(attendee.callSign))')
          .addGroupBy('operator.id')
          .addGroupBy('user.picture')
          .orderBy('value', 'DESC')
          .limit(5);
        if (applyPeriod) qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawMany();
      })(),
    ]);

    const branchTopOperators: LeaderboardEntry[] = branchTopManagersRaw.map(
      (op, index) => ({
        rank: index + 1,
        callSign: op.callSign,
        operatorId: op.operatorId || null,
        picture: op.picture || null,
        value: parseInt(String(op.value), 10),
        label: 'nets',
      }),
    );

    const branchTopNets: LeaderboardEntry[] = branchTopNetsRaw.map(
      (net, index) => ({
        rank: index + 1,
        callSign: net.name,
        netId: net.netId || null,
        value: parseInt(String(net.value), 10),
        label: 'attendees',
      }),
    );

    const branchTopParticipants: LeaderboardEntry[] = branchTopParticipantsRaw.map(
      (row, index) => ({
        rank: index + 1,
        callSign: row.callSign,
        operatorId: row.operatorId || null,
        picture: row.picture || null,
        value: parseInt(String(row.value), 10),
        label: 'attendance',
      }),
    );

    return {
      branch: {
        totalNets: branchTotalNets,
        totalAttendees: parseInt(
          String(branchTotalAttendeesResult?.count ?? '0'),
          10,
        ),
        totalUniqueParticipants: parseInt(
          String(branchTotalUniqueResult?.count ?? '0'),
          10,
        ),
        topOperators: branchTopOperators,
        topNets: branchTopNets,
        topParticipants: branchTopParticipants,
      },
      global: globalStats,
    };
  }

  private getLast3Months(
    now: Date,
  ): { start: Date; end: Date; month: number; year: number }[] {
    const months: { start: Date; end: Date; month: number; year: number }[] =
      [];

    for (let i = 0; i < 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      months.push({
        start,
        end: i === 0 ? now : end,
        month: date.getMonth(),
        year: date.getFullYear(),
      });
    }

    return months.reverse();
  }

  private async getMonthlyStats(
    months: { start: Date; end: Date; month: number; year: number }[],
  ): Promise<MonthlyStats[]> {
    const monthNames = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ];

    const stats: MonthlyStats[] = [];

    for (const { start, end, month, year } of months) {
      const [netsCount, attendeesData] = await Promise.all([
        this.netRepository
          .createQueryBuilder('net')
          .where('net.startedAt >= :start', { start })
          .andWhere('net.startedAt <= :end', { end })
          .andWhere('net.endedAt IS NOT NULL')
          .getCount(),

        this.attendeeRepository
          .createQueryBuilder('attendee')
          .leftJoin('attendee.net', 'net')
          .select([
            'COUNT(attendee.id) as "totalAttendees"',
            'COUNT(DISTINCT UPPER(TRIM(attendee.callSign))) as "uniqueParticipants"',
          ])
          .where('net.startedAt >= :start', { start })
          .andWhere('net.startedAt <= :end', { end })
          .andWhere('net.endedAt IS NOT NULL')
          .getRawOne(),
      ]);

      stats.push({
        month: monthNames[month],
        year,
        monthIndex: month,
        netsCount,
        totalAttendees: parseInt(
          String(attendeesData?.totalAttendees ?? '0'),
          10,
        ),
        uniqueParticipants: parseInt(
          String(attendeesData?.uniqueParticipants ?? '0'),
          10,
        ),
      });
    }

    return stats;
  }

  async getActivity(userId?: string, limit: number = 10, offset: number = 0) {
    const query = this.activityRepository
      .createQueryBuilder('activity')
      .orderBy('activity.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    if (userId) {
      query.where(
        'activity.userId = :userId OR ' +
          'activity.actorCallSign IN (SELECT "callSign" FROM operators WHERE "userId" = :userId) OR ' +
          'activity.targetCallSign IN (SELECT "callSign" FROM operators WHERE "userId" = :userId)',
        { userId: String(userId) },
      );
    }

    return query.getMany();
  }

  async getPersonalLastNets(userId: string): Promise<PersonalLastNetsResponse> {
    const [lastAttended, lastManaged] = await Promise.all([
      this.attendeeRepository.findOne({
        where: { operator: { user: { id: userId } } },
        order: { createdAt: 'DESC' },
        relations: { net: true },
        select: { net: { id: true, name: true, startedAt: true } },
      }),
      this.netRepository.findOne({
        where: { operator: { user: { id: userId } } },
        order: { startedAt: 'DESC' },
        select: { id: true, name: true, startedAt: true },
      }),
    ]);

    return {
      lastAttended: lastAttended?.net
        ? {
            id: lastAttended.net.id,
            name: lastAttended.net.name,
            date: lastAttended.net.startedAt
              ? new Date(lastAttended.net.startedAt).toISOString()
              : '',
            netId: lastAttended.net.id,
          }
        : null,
      lastManaged: lastManaged
        ? {
            id: lastManaged.id,
            name: lastManaged.name,
            date: lastManaged.startedAt
              ? new Date(lastManaged.startedAt).toISOString()
              : '',
            netId: lastManaged.id,
          }
        : null,
    };
  }

  async getTopStreakByBranch(branchId: string): Promise<TopStreakEntry[]> {
    const attendances = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoin('attendee.net', 'net')
      .leftJoin('attendee.operator', 'operator')
      .select([
        'operator.id as "operatorId"',
        'operator.callSign as "callSign"',
        'net.endedAt as "netDate"',
      ])
      .where('net.branchId = :branchId', { branchId })
      .andWhere('net.endedAt IS NOT NULL')
      .orderBy('operator.id', 'ASC')
      .addOrderBy('net.endedAt', 'ASC')
      .getRawMany();

    const byOperator = new Map<
      string,
      { operatorId: string; callSign: string; dates: Date[] }
    >();
    for (const row of attendances) {
      const key = String(row.operatorId ?? row.callSign);
      if (!byOperator.has(key)) {
        byOperator.set(key, {
          operatorId: String(row.operatorId ?? ''),
          callSign: String(row.callSign ?? ''),
          dates: [],
        });
      }
      if (row.netDate) {
        byOperator.get(key)!.dates.push(new Date(row.netDate));
      }
    }

    const streaks: { operatorId: string; callSign: string; streak: number }[] =
      [];
    for (const [, data] of byOperator) {
      const sorted = [...data.dates].sort(
        (a, b) => a.getTime() - b.getTime(),
      );
      let maxStreak = 1;
      let current = 1;
      for (let i = 1; i < sorted.length; i++) {
        const days =
          (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        if (days <= 7) {
          current++;
          maxStreak = Math.max(maxStreak, current);
        } else {
          current = 1;
        }
      }
      streaks.push({
        operatorId: data.operatorId,
        callSign: data.callSign,
        streak: maxStreak,
      });
    }

    return streaks
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 10)
      .map((s, i) => ({
        rank: i + 1,
        callSign: s.callSign,
        operatorId: s.operatorId || null,
        value: s.streak,
      }));
  }

  async getParticipation(
    period: ParticipationPeriod,
  ): Promise<ParticipationStatsResponse> {
    const now = new Date();
    let start: Date;
    if (period === '7d') {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (period === '30d') {
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(0);
    }

    const qbNet = this.netRepository
      .createQueryBuilder('net')
      .where('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL');
    const qbAttendee = this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.net', 'net')
      .where('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL');

    if (period !== 'all') {
      qbNet.andWhere('net.endedAt >= :start', { start });
      qbAttendee.andWhere('net.endedAt >= :start', { start });
    }

    const [completedNets, uniqueResult] = await Promise.all([
      qbNet.getCount(),
      qbAttendee
        .select('COUNT(DISTINCT UPPER(TRIM(attendee.callSign)))', 'count')
        .getRawOne(),
    ]);

    const uniqueParticipants = parseInt(
      String(uniqueResult?.count ?? '0'),
      10,
    );
    const avgUniqueParticipantsPerNet =
      completedNets > 0
        ? Math.round((uniqueParticipants / completedNets) * 10) / 10
        : 0;

    return {
      period,
      completedNets,
      uniqueParticipants,
      avgUniqueParticipantsPerNet,
    };
  }

  async getPersonalTrend(
    userId: string,
    branchId?: string,
  ): Promise<PersonalTrendResponse> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const baseAttended = this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoin('attendee.net', 'net')
      .leftJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .where('user.id = :userId', { userId });
    const baseManaged = this.netRepository
      .createQueryBuilder('net')
      .leftJoin('net.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL');

    const [thisMonthParticipated, lastMonthParticipated, thisMonthManaged, lastMonthManaged] =
      await Promise.all([
        branchId
          ? baseAttended
              .clone()
              .andWhere('net.branchId = :branchId', { branchId })
              .andWhere('net.endedAt >= :thisMonthStart', {
                thisMonthStart,
              })
              .getCount()
          : baseAttended
              .clone()
              .andWhere('net.endedAt >= :thisMonthStart', {
                thisMonthStart,
              })
              .getCount(),
        branchId
          ? baseAttended
              .clone()
              .andWhere('net.branchId = :branchId', { branchId })
              .andWhere('net.endedAt >= :lastMonthStart', {
                lastMonthStart,
              })
              .andWhere('net.endedAt <= :lastMonthEnd', { lastMonthEnd })
              .getCount()
          : baseAttended
              .clone()
              .andWhere('net.endedAt >= :lastMonthStart', {
                lastMonthStart,
              })
              .andWhere('net.endedAt <= :lastMonthEnd', { lastMonthEnd })
              .getCount(),
        branchId
          ? baseManaged
              .clone()
              .andWhere('net.branchId = :branchId', { branchId })
              .andWhere('net.endedAt >= :thisMonthStart', {
                thisMonthStart,
              })
              .getCount()
          : baseManaged
              .clone()
              .andWhere('net.endedAt >= :thisMonthStart', {
                thisMonthStart,
              })
              .getCount(),
        branchId
          ? baseManaged
              .clone()
              .andWhere('net.branchId = :branchId', { branchId })
              .andWhere('net.endedAt >= :lastMonthStart', {
                lastMonthStart,
              })
              .andWhere('net.endedAt <= :lastMonthEnd', { lastMonthEnd })
              .getCount()
          : baseManaged
              .clone()
              .andWhere('net.endedAt >= :lastMonthStart', {
                lastMonthStart,
              })
              .andWhere('net.endedAt <= :lastMonthEnd', { lastMonthEnd })
              .getCount(),
      ]);

    return {
      thisMonthParticipated,
      lastMonthParticipated,
      thisMonthManaged,
      lastMonthManaged,
    };
  }

  async getActivitySummary(
    period: ActivitySummaryPeriod = '7d',
  ): Promise<ActivitySummaryResponse> {
    const qb = this.activityRepository
      .createQueryBuilder('activity')
      .select('activity.type', 'type')
      .addSelect('COUNT(activity.id)', 'count')
      .groupBy('activity.type');

    if (period === '7d') {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      since.setHours(0, 0, 0, 0);
      qb.where('activity.createdAt >= :since', { since });
    } else if (period === '30d') {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      since.setHours(0, 0, 0, 0);
      qb.where('activity.createdAt >= :since', { since });
    }

    const raw = await qb.getRawMany();
    const map = new Map(raw.map((r) => [String(r.type), parseInt(String(r.count), 10)]));
    return {
      period,
      netsStarted: map.get('net.started') ?? 0,
      netsEnded: map.get('net.ended') ?? 0,
      attendeesAdded: map.get('attendee.added') ?? 0,
    };
  }

  async getBusiestTime(): Promise<BusiestTimeResponse> {
    const nets = await this.netRepository.find({
      where: { startedAt: Not(IsNull()) },
      select: { startedAt: true },
    });

    const byDay = new Array(7).fill(0).map((_, i) => ({ dayOfWeek: i, count: 0 }));
    const byHour = new Array(24).fill(0).map((_, i) => ({ hour: i, count: 0 }));

    for (const net of nets) {
      if (!net.startedAt) continue;
      const d = new Date(net.startedAt);
      const day = d.getDay();
      const hour = d.getHours();
      if (day >= 0 && day < 7) byDay[day].count++;
      if (hour >= 0 && hour < 24) byHour[hour].count++;
    }

    return {
      byDay: byDay.map((d) => ({ dayOfWeek: d.dayOfWeek, count: d.count })),
      byHour: byHour.map((h) => ({ hour: h.hour, count: h.count })),
    };
  }

  async getGeography(): Promise<GeographyStatsResponse> {
    const countriesRaw = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.net', 'net')
      .select('TRIM(attendee.country)', 'country')
      .addSelect('COUNT(attendee.id)', 'count')
      .where('attendee.country IS NOT NULL')
      .andWhere("TRIM(attendee.country) != ''")
      .andWhere('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .groupBy('TRIM(attendee.country)')
      .orderBy('count', 'DESC')
      .limit(50)
      .getRawMany();

    const citiesRaw = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.net', 'net')
      .select('TRIM(attendee.city)', 'city')
      .addSelect('COUNT(attendee.id)', 'count')
      .where('attendee.city IS NOT NULL')
      .andWhere("TRIM(attendee.city) != ''")
      .andWhere('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .groupBy('TRIM(attendee.city)')
      .orderBy('count', 'DESC')
      .limit(100)
      .getRawMany();

    const districtsRaw = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.net', 'net')
      .select('TRIM(attendee.city)', 'city')
      .addSelect('TRIM(attendee.district)', 'district')
      .addSelect('COUNT(attendee.id)', 'count')
      .where('attendee.city IS NOT NULL')
      .andWhere("TRIM(attendee.city) != ''")
      .andWhere('attendee.district IS NOT NULL')
      .andWhere("TRIM(attendee.district) != ''")
      .andWhere('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .groupBy('TRIM(attendee.city)')
      .addGroupBy('TRIM(attendee.district)')
      .orderBy('count', 'DESC')
      .limit(100)
      .getRawMany();

    return {
      countries: countriesRaw.map((r) => ({
        country: String(r.country ?? ''),
        count: parseInt(String(r.count), 10),
      })),
      cities: citiesRaw.map((r) => ({
        city: String(r.city ?? ''),
        count: parseInt(String(r.count), 10),
      })),
      districts: districtsRaw.map((r) => ({
        city: String(r.city ?? ''),
        district: String(r.district ?? ''),
        count: parseInt(String(r.count), 10),
      })),
    };
  }

  async getMonthlyTrend(
    months: number = 12,
  ): Promise<MonthlyTrendEntry[]> {
    const now = new Date();
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ];
    const entries: MonthlyTrendEntry[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const endCap = i === 0 ? now : end;

      const [completedNets, uniqueResult] = await Promise.all([
        this.netRepository
          .createQueryBuilder('net')
          .where('net.startedAt >= :start', { start })
          .andWhere('net.startedAt <= :endCap', { endCap })
          .andWhere('net.endedAt IS NOT NULL')
          .getCount(),
        this.attendeeRepository
          .createQueryBuilder('attendee')
          .innerJoin('attendee.net', 'net')
          .select('COUNT(DISTINCT UPPER(TRIM(attendee.callSign)))', 'count')
          .where('net.startedAt >= :start', { start })
          .andWhere('net.startedAt <= :endCap', { endCap })
          .andWhere('net.endedAt IS NOT NULL')
          .getRawOne(),
      ]);

      const rawCount =
        uniqueResult?.count ??
        (uniqueResult && (uniqueResult as Record<string, unknown>)['count']) ??
        '0';
      entries.push({
        month: monthNames[date.getMonth()],
        year: date.getFullYear(),
        monthIndex: date.getMonth(),
        completedNets,
        uniqueParticipants: parseInt(String(rawCount), 10) || 0,
      });
    }

    return entries;
  }

  async getNetsAttendeesTrend(
    limit: number = 30,
    branchId?: string,
  ): Promise<NetsAttendeesTrendEntry[]> {
    const qb = this.netRepository
      .createQueryBuilder('net')
      .leftJoin('net.attendees', 'attendee')
      .select('net.id', 'id')
      .addSelect('net.name', 'netName')
      .addSelect('net.endedAt', 'endedAt')
      .addSelect('COUNT(attendee.id)', 'attendeeCount')
      .where('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .groupBy('net.id')
      .addGroupBy('net.name')
      .addGroupBy('net.endedAt')
      .orderBy('net.endedAt', 'DESC')
      .limit(Math.min(Math.max(limit, 1), 50));

    if (branchId) {
      qb.andWhere('net.branchId = :branchId', { branchId });
    }

    const raw = await qb.getRawMany();
    const reversed = raw.reverse();
    return reversed.map((r) => ({
      endedAt: r.endedAt instanceof Date ? r.endedAt.toISOString() : String(r.endedAt ?? ''),
      attendeeCount: parseInt(String(r.attendeeCount ?? '0'), 10),
      netName: String(r.netName ?? ''),
    }));
  }

  private async calculateStreak(userId: string): Promise<number> {
    const attendances = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoinAndSelect('attendee.net', 'net')
      .leftJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('net.endedAt IS NOT NULL')
      .orderBy('net.endedAt', 'ASC')
      .getMany();

    if (!attendances.length) return 0;

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < attendances.length; i++) {
      const prevDate = new Date(attendances[i - 1].net.endedAt);
      const currDate = new Date(attendances[i].net.endedAt);
      const daysDiff =
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 7) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return maxStreak;
  }

  private async calculateStreakForBranch(
    userId: string,
    branchId: string,
  ): Promise<number> {
    const attendances = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoinAndSelect('attendee.net', 'net')
      .leftJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('net.branchId = :branchId', { branchId })
      .andWhere('net.endedAt IS NOT NULL')
      .orderBy('net.endedAt', 'ASC')
      .getMany();

    if (!attendances.length) return 0;

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < attendances.length; i++) {
      const prevDate = new Date(attendances[i - 1].net.endedAt);
      const currDate = new Date(attendances[i].net.endedAt);
      const daysDiff =
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 7) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return maxStreak;
  }

  async getNetComparePrevious(
    netId: string,
  ): Promise<NetComparePreviousResponse | null> {
    const current = await this.netRepository.findOne({
      where: { id: netId },
      select: ['id', 'branchId', 'startedAt', 'endedAt'],
    });
    if (
      !current?.branchId ||
      !current.startedAt ||
      !current.endedAt
    ) {
      return null;
    }

    const previous = await this.netRepository
      .createQueryBuilder('net')
      .where('net.branchId = :branchId', { branchId: current.branchId })
      .andWhere('net.id != :currentId', { currentId: netId })
      .andWhere('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .andWhere('net.endedAt < :endedAt', {
        endedAt: current.endedAt,
      })
      .orderBy('net.endedAt', 'DESC')
      .limit(1)
      .getOne();

    if (!previous?.startedAt || !previous?.endedAt) {
      return null;
    }

    const [currentCount, previousCount] = await Promise.all([
      this.attendeeRepository.count({ where: { net: { id: netId } } }),
      this.attendeeRepository.count({
        where: { net: { id: previous.id } },
      }),
    ]);

    const currentDurationMs =
      new Date(current.endedAt).getTime() -
      new Date(current.startedAt).getTime();
    const previousDurationMs =
      new Date(previous.endedAt).getTime() -
      new Date(previous.startedAt).getTime();
    const currentDurationMinutes = Math.floor(currentDurationMs / 60000);
    const previousDurationMinutes = Math.floor(previousDurationMs / 60000);

    return {
      previousAttendeeCount: previousCount,
      previousDurationMinutes,
      deltaAttendeeCount: currentCount - previousCount,
      deltaDurationMinutes: currentDurationMinutes - previousDurationMinutes,
      previousEndedAt: previous.endedAt.toISOString(),
    };
  }
}
