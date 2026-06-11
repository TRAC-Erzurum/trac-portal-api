import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, SelectQueryBuilder } from 'typeorm';
import { Net } from '../../net/entities/net.entity';
import { Attendee } from '../../net/entities/attendee.entity';
import { Operator } from '../../operator/entities/operator.entity';
import { Activity } from '../../activity/entities/activity.entity';
import { OperatorBranchMembership } from '../../branch/entities/operator-branch-membership.entity';
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
  certificateTemplateId?: string | null;
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
  certificateTemplateId?: string | null;
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
  /** Son tamamlanmış çevrimler, en yeniden eskiye (en fazla 3). */
  lastAttendedNets: LastNetInfo[];
  lastManagedNets: LastNetInfo[];
}

export interface TopStreakEntry {
  rank: number;
  callSign: string;
  operatorId: string | null;
  value: number;
}

export type ParticipationPeriod = 'all' | '7d' | '30d';
export type StatsScope = 'all' | 'my-branches' | 'branch';

export interface ParticipationStatsResponse {
  period: ParticipationPeriod;
  completedNets: number;
  uniqueParticipants: number;
  avgUniqueParticipantsPerNet: number;
}

export interface PersonalTrendMonthlyPoint {
  year: number;
  monthIndex: number;
  participated: number;
  managed: number;
}

export interface PersonalTrendResponse {
  thisMonthParticipated: number;
  lastMonthParticipated: number;
  thisMonthManaged: number;
  lastMonthManaged: number;
  /** Son 12 ay (eskiden yeniye), ay başına katılım ve yönetim sayıları. */
  monthlySeries: PersonalTrendMonthlyPoint[];
}

export interface BusiestTimeResponse {
  /** UTC gün (0–6) ve saat (0–23). Frontend browser timezone'una çevirir. */
  byDay: { dayOfWeek: number; count: number }[];
  byHour: { hour: number; count: number }[];
  /** UTC haftanın günü × saat yoğunluğu. */
  cells: { dayOfWeek: number; hour: number; count: number }[];
}

export type GeographyCountMode = 'total' | 'unique';

export interface GeographyStatsResponse {
  countries: { country: string; count: number; iso2?: string }[];
  cities: {
    city: string;
    count: number;
    /** İsteğe bağlı; harita bileşeni eksikse `/qth/geocode` ile doldurur. */
    lat?: number;
    lng?: number;
  }[];
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
    @InjectRepository(OperatorBranchMembership)
    private readonly membershipRepository: Repository<OperatorBranchMembership>,
  ) {}

  private async getBranchIdsForUser(userId: string): Promise<string[]> {
    const operator = await this.operatorRepository.findOne({
      where: { user: { id: userId } },
      select: ['id'],
    });
    if (!operator) {
      return [];
    }
    const memberships = await this.membershipRepository.find({
      where: { operatorId: operator.id, status: MembershipStatus.APPROVED },
      select: ['branchId'],
    });
    return memberships.map((m) => m.branchId);
  }

  async resolveBranchIdsForScope(
    userId: string | undefined,
    scope: StatsScope = 'all',
    branchId?: string,
  ): Promise<string[] | null> {
    if (scope === 'branch') {
      return branchId ? [branchId] : [];
    }

    if (scope === 'my-branches') {
      if (!userId) {
        return [];
      }
      return this.getBranchIdsForUser(userId);
    }

    return null;
  }

  private applyBranchFilter<T>(
    qb: SelectQueryBuilder<T>,
    branchIds: string[] | null,
    alias: string = 'net',
  ) {
    if (branchIds && branchIds.length > 0) {
      qb.andWhere(`${alias}.branchId IN (:...branchIds)`, { branchIds });
    }
    return qb;
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

  async getActiveNets(
    limit: number = 5,
    userId?: string,
  ): Promise<ActiveNet[]> {
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
      certificateTemplateId: net.certificateTemplateId ?? undefined,
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

  async getPendingNets(
    limit: number = 5,
    userId?: string,
  ): Promise<PendingNet[]> {
    const branchIds = userId ? await this.getBranchIdsForUser(userId) : null;
    if (branchIds !== null && branchIds.length === 0) return [];

    const qb = this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('net.branch', 'branch')
      .leftJoinAndSelect('net.branchCallSign', 'branchCallSign')
      .where('net.startedAt IS NULL')
      .andWhere('net.endedAt IS NULL');

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
      certificateTemplateId: net.certificateTemplateId ?? undefined,
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

  async getRecentCancelledNets(
    limit: number = 3,
    userId?: string,
  ): Promise<PendingNet[]> {
    const branchIds = userId ? await this.getBranchIdsForUser(userId) : null;
    if (branchIds !== null && branchIds.length === 0) return [];

    const qb = this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('net.branch', 'branch')
      .leftJoinAndSelect('net.branchCallSign', 'branchCallSign')
      .where('net.startedAt IS NULL')
      .andWhere('net.endedAt IS NOT NULL');

    if (branchIds !== null) {
      qb.andWhere('net.branchId IN (:...branchIds)', { branchIds });
    }

    const nets = await qb.orderBy('net.endedAt', 'DESC').limit(limit).getMany();

    return nets.map((net) => ({
      id: net.id,
      name: net.name,
      operatorCallSign: net.operator?.callSign || 'Unknown',
      endedAt:
        net.endedAt instanceof Date
          ? net.endedAt.toISOString()
          : String(net.endedAt ?? ''),
      certificateTemplateId: net.certificateTemplateId ?? undefined,
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

  async getRecentCompletedNets(
    limit: number = 3,
    userId?: string,
  ): Promise<ActiveNet[]> {
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

    const nets = await qb.orderBy('net.endedAt', 'DESC').limit(limit).getMany();

    return nets.map((net) => {
      const duration =
        net.totalDurationMinutes != null && net.totalDurationMinutes > 0
          ? net.totalDurationMinutes
          : net.startedAt && net.endedAt
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
        certificateTemplateId: net.certificateTemplateId ?? undefined,
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
    scope: StatsScope = 'all',
    branchId?: string,
  ): Promise<PersonalNetStats | PersonalNetStatsBranchAware> {
    const branchIds = await this.resolveBranchIdsForScope(
      userId,
      scope,
      branchId,
    );
    if (branchIds && branchIds.length === 0) {
      return { attendedNets: 0, managedNets: 0, streak: 0 };
    }

    const attendedQb = this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoin('attendee.net', 'net')
      .leftJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('net.endedAt IS NOT NULL');
    const managedQb = this.netRepository
      .createQueryBuilder('net')
      .leftJoin('net.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL');

    this.applyBranchFilter(attendedQb, branchIds);
    this.applyBranchFilter(managedQb, branchIds);

    const [attendedNets, managedNets, streak] = await Promise.all([
      attendedQb.getCount(),
      managedQb.getCount(),
      this.calculateStreak(userId, branchIds),
    ]);

    return { attendedNets, managedNets, streak };
  }

  async getCommunityStats(
    userId: string | undefined,
    scope: StatsScope = 'all',
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
    const branchIds = await this.resolveBranchIdsForScope(
      userId,
      scope,
      branchId,
    );
    if (branchIds && branchIds.length === 0) {
      // explicit empty set (selected branch has no nets or user has no branches)
      // return branch-aware empty result when scope === 'branch', otherwise global zeros
      const emptyMonthly = last3Months.map(() => ({
        month: '',
        year: 0,
        monthIndex: 0,
        netsCount: 0,
        totalAttendees: 0,
        uniqueParticipants: 0,
      }));

      if (scope === 'branch') {
        return {
          branch: {
            totalNets: 0,
            totalAttendees: 0,
            totalUniqueParticipants: 0,
            topOperators: [],
            topNets: [],
            topParticipants: [],
          },
          global: {
            totalUniqueParticipants: 0,
            totalCompletedNets: 0,
            monthlyStats: emptyMonthly,
            topParticipants: [],
            topNetManagers: [],
            topNets: [],
          },
        };
      }

      return {
        totalUniqueParticipants: 0,
        totalCompletedNets: 0,
        totalAttendees: 0,
        monthlyStats: emptyMonthly,
        topParticipants: [],
        topNetManagers: [],
        topNets: [],
      };
    }

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
        this.applyBranchFilter(qb, branchIds);
        if (applyPeriod)
          qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawOne();
      })(),

      (() => {
        const qb = this.netRepository
          .createQueryBuilder('net')
          .where('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL');
        this.applyBranchFilter(qb, branchIds);
        if (applyPeriod)
          qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getCount();
      })(),

      (() => {
        const qb = this.attendeeRepository
          .createQueryBuilder('attendee')
          .innerJoin('attendee.net', 'net')
          .select('COUNT(attendee.id)', 'count')
          .where('net.startedAt IS NOT NULL')
          .andWhere('net.endedAt IS NOT NULL');
        this.applyBranchFilter(qb, branchIds);
        if (applyPeriod)
          qb.andWhere('net.endedAt >= :communityStart', { communityStart });
        return qb.getRawOne();
      })(),

      this.getMonthlyStats(last3Months, branchIds),

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
        this.applyBranchFilter(qb, branchIds);
        if (applyPeriod)
          qb.andWhere('net.endedAt >= :communityStart', { communityStart });
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
        this.applyBranchFilter(qb, branchIds);
        if (applyPeriod)
          qb.andWhere('net.endedAt >= :communityStart', { communityStart });
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
        this.applyBranchFilter(qb, branchIds);
        if (applyPeriod)
          qb.andWhere('net.endedAt >= :communityStart', { communityStart });
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

    return globalStats;
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
    branchIds: string[] | null = null,
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
          .andWhere(
            branchIds && branchIds.length > 0
              ? 'net.branchId IN (:...branchIds)'
              : '1=1',
            { branchIds },
          )
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
          .andWhere(
            branchIds && branchIds.length > 0
              ? 'net.branchId IN (:...branchIds)'
              : '1=1',
            { branchIds },
          )
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
    const rawRows = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.net', 'net')
      .innerJoin('attendee.operator', 'operator')
      .innerJoin('operator.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('net.endedAt IS NOT NULL')
      .select('net.id', 'netId')
      .addSelect('net.name', 'name')
      .addSelect('net.endedAt', 'endedAt')
      .orderBy('net.endedAt', 'DESC')
      .getRawMany();

    const seenNetIds = new Set<string>();
    const lastAttendedNets: LastNetInfo[] = [];
    for (const row of rawRows) {
      const id = String(row.netId ?? '');
      if (!id || seenNetIds.has(id)) continue;
      seenNetIds.add(id);
      lastAttendedNets.push({
        id,
        netId: id,
        name: String(row.name ?? ''),
        date: row.endedAt ? new Date(row.endedAt).toISOString() : '',
      });
      if (lastAttendedNets.length >= 3) break;
    }

    const managedNets = await this.netRepository
      .createQueryBuilder('net')
      .innerJoin('net.operator', 'operator')
      .innerJoin('operator.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('net.endedAt IS NOT NULL')
      .orderBy('net.endedAt', 'DESC')
      .take(3)
      .select(['net.id', 'net.name', 'net.endedAt'])
      .getMany();

    const lastManagedNets: LastNetInfo[] = managedNets.map((n) => ({
      id: n.id,
      netId: n.id,
      name: n.name,
      date: n.endedAt ? new Date(n.endedAt).toISOString() : '',
    }));

    return { lastAttendedNets, lastManagedNets };
  }

  async getTopStreakByBranch(branchId: string): Promise<TopStreakEntry[]> {
    return this.getTopStreak([branchId]);
  }

  async getTopStreak(
    branchIds: string[] | null = null,
  ): Promise<TopStreakEntry[]> {
    const attendances = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoin('attendee.net', 'net')
      .leftJoin('attendee.operator', 'operator')
      .select([
        'operator.id as "operatorId"',
        'operator.callSign as "callSign"',
        'net.endedAt as "netDate"',
      ])
      .where(
        branchIds && branchIds.length > 0
          ? 'net.branchId IN (:...branchIds)'
          : '1=1',
        { branchIds },
      )
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
        byOperator.get(key).dates.push(new Date(row.netDate));
      }
    }

    const streaks: { operatorId: string; callSign: string; streak: number }[] =
      [];
    for (const [, data] of byOperator) {
      const sorted = [...data.dates].sort((a, b) => a.getTime() - b.getTime());
      let maxStreak = 1;
      let current = 1;
      for (let i = 1; i < sorted.length; i++) {
        const days =
          (sorted[i].getTime() - sorted[i - 1].getTime()) /
          (1000 * 60 * 60 * 24);
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
    branchIds: string[] | null = null,
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

    this.applyBranchFilter(qbNet, branchIds);
    this.applyBranchFilter(qbAttendee, branchIds);

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

    const uniqueParticipants = parseInt(String(uniqueResult?.count ?? '0'), 10);
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
    scope: StatsScope = 'all',
    branchId?: string,
  ): Promise<PersonalTrendResponse> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );

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

    const branchIds = await this.resolveBranchIdsForScope(
      userId,
      scope,
      branchId,
    );
    if (branchIds && branchIds.length === 0) {
      return {
        thisMonthParticipated: 0,
        lastMonthParticipated: 0,
        thisMonthManaged: 0,
        lastMonthManaged: 0,
        monthlySeries: Array.from({ length: 12 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
          return {
            year: d.getFullYear(),
            monthIndex: d.getMonth(),
            participated: 0,
            managed: 0,
          };
        }),
      };
    }

    const [
      thisMonthParticipated,
      lastMonthParticipated,
      thisMonthManaged,
      lastMonthManaged,
    ] = await Promise.all([
      this.applyBranchFilter(
        baseAttended
          .clone()
          .andWhere('net.endedAt >= :thisMonthStart', { thisMonthStart }),
        branchIds,
      ).getCount(),
      this.applyBranchFilter(
        baseAttended
          .clone()
          .andWhere('net.endedAt >= :lastMonthStart', { lastMonthStart })
          .andWhere('net.endedAt <= :lastMonthEnd', { lastMonthEnd }),
        branchIds,
      ).getCount(),
      this.applyBranchFilter(
        baseManaged
          .clone()
          .andWhere('net.endedAt >= :thisMonthStart', { thisMonthStart }),
        branchIds,
      ).getCount(),
      this.applyBranchFilter(
        baseManaged
          .clone()
          .andWhere('net.endedAt >= :lastMonthStart', { lastMonthStart })
          .andWhere('net.endedAt <= :lastMonthEnd', { lastMonthEnd }),
        branchIds,
      ).getCount(),
    ]);

    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 11,
      1,
      0,
      0,
      0,
      0,
    );

    const participatedMonthlyQb = this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.net', 'net')
      .innerJoin('attendee.operator', 'operator')
      .innerJoin('operator.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('net.endedAt IS NOT NULL')
      .andWhere('net.endedAt >= :monthStart', { monthStart })
      .select("to_char(date_trunc('month', net.endedAt), 'YYYY-MM')", 'ym')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('ym')
      .orderBy('ym', 'ASC');
    this.applyBranchFilter(participatedMonthlyQb, branchIds);

    const managedMonthlyQb = this.netRepository
      .createQueryBuilder('net')
      .innerJoin('net.operator', 'operator')
      .innerJoin('operator.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('net.endedAt IS NOT NULL')
      .andWhere('net.endedAt >= :monthStart', { monthStart })
      .select("to_char(date_trunc('month', net.endedAt), 'YYYY-MM')", 'ym')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('ym')
      .orderBy('ym', 'ASC');
    this.applyBranchFilter(managedMonthlyQb, branchIds);

    const [participatedBuckets, managedBuckets] = await Promise.all([
      participatedMonthlyQb.getRawMany(),
      managedMonthlyQb.getRawMany(),
    ]);

    const pMap = new Map<string, number>();
    for (const r of participatedBuckets) {
      pMap.set(String(r.ym), parseInt(String(r.cnt), 10));
    }
    const mMap = new Map<string, number>();
    for (const r of managedBuckets) {
      mMap.set(String(r.ym), parseInt(String(r.cnt), 10));
    }

    const monthlySeries: PersonalTrendMonthlyPoint[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlySeries.push({
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        participated: pMap.get(ym) ?? 0,
        managed: mMap.get(ym) ?? 0,
      });
    }

    return {
      thisMonthParticipated,
      lastMonthParticipated,
      thisMonthManaged,
      lastMonthManaged,
      monthlySeries,
    };
  }

  async getBusiestTime(
    branchIds: string[] | null = null,
  ): Promise<BusiestTimeResponse> {
    type BusiestTimeRawRow = {
      dayOfWeek: string | number;
      hour: string | number;
      count: string | number;
    };

    const qb = this.netRepository
      .createQueryBuilder('net')
      .select('EXTRACT(DOW FROM net.startedAt)::int', 'dayOfWeek')
      .addSelect('EXTRACT(HOUR FROM net.startedAt)::int', 'hour')
      .addSelect('COUNT(*)::int', 'count')
      .where('net.startedAt IS NOT NULL')
      .groupBy('EXTRACT(DOW FROM net.startedAt)::int')
      .addGroupBy('EXTRACT(HOUR FROM net.startedAt)::int')
      .orderBy('EXTRACT(DOW FROM net.startedAt)::int', 'ASC')
      .addOrderBy('EXTRACT(HOUR FROM net.startedAt)::int', 'ASC');
    this.applyBranchFilter(qb, branchIds);

    const rows = await qb.getRawMany<BusiestTimeRawRow>();

    const byDay = new Array(7)
      .fill(0)
      .map((_, i) => ({ dayOfWeek: i, count: 0 }));
    const byHour = new Array(24).fill(0).map((_, i) => ({ hour: i, count: 0 }));

    const cells = rows
      .map((row) => ({
        dayOfWeek: Number(row.dayOfWeek),
        hour: Number(row.hour),
        count: Number(row.count),
      }))
      .filter(
        (cell) =>
          Number.isInteger(cell.dayOfWeek) &&
          cell.dayOfWeek >= 0 &&
          cell.dayOfWeek < 7 &&
          Number.isInteger(cell.hour) &&
          cell.hour >= 0 &&
          cell.hour < 24,
      )
      .sort((a, b) =>
        a.dayOfWeek !== b.dayOfWeek
          ? a.dayOfWeek - b.dayOfWeek
          : a.hour - b.hour,
      );

    for (const cell of cells) {
      byDay[cell.dayOfWeek].count += cell.count;
      byHour[cell.hour].count += cell.count;
    }

    return {
      byDay,
      byHour,
      cells,
    };
  }

  async getGeography(
    mode: GeographyCountMode = 'unique',
    branchIds: string[] | null = null,
  ): Promise<GeographyStatsResponse> {
    const countExpr =
      mode === 'unique'
        ? 'COUNT(DISTINCT UPPER(TRIM(attendee.callSign)))'
        : 'COUNT(attendee.id)';

    const countriesQb = this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.net', 'net')
      .select('TRIM(attendee.country)', 'country')
      .addSelect(countExpr, 'count')
      .where('attendee.country IS NOT NULL')
      .andWhere("TRIM(attendee.country) != ''")
      .andWhere('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .groupBy('TRIM(attendee.country)')
      .orderBy('count', 'DESC')
      .limit(50);
    this.applyBranchFilter(countriesQb, branchIds);
    const countriesRaw = await countriesQb.getRawMany();

    const citiesQb = this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.net', 'net')
      .select('TRIM(attendee.city)', 'city')
      .addSelect(countExpr, 'count')
      .where('attendee.city IS NOT NULL')
      .andWhere("TRIM(attendee.city) != ''")
      .andWhere('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .groupBy('TRIM(attendee.city)')
      .orderBy('count', 'DESC')
      .limit(100);
    this.applyBranchFilter(citiesQb, branchIds);
    const citiesRaw = await citiesQb.getRawMany();

    const districtsQb = this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.net', 'net')
      .select('TRIM(attendee.city)', 'city')
      .addSelect('TRIM(attendee.district)', 'district')
      .addSelect(countExpr, 'count')
      .where('attendee.city IS NOT NULL')
      .andWhere("TRIM(attendee.city) != ''")
      .andWhere('attendee.district IS NOT NULL')
      .andWhere("TRIM(attendee.district) != ''")
      .andWhere('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .groupBy('TRIM(attendee.city)')
      .addGroupBy('TRIM(attendee.district)')
      .orderBy('count', 'DESC')
      .limit(100);
    this.applyBranchFilter(districtsQb, branchIds);
    const districtsRaw = await districtsQb.getRawMany();

    const cities: GeographyStatsResponse['cities'] = citiesRaw.map((r) => ({
      city: String(r.city ?? ''),
      count: parseInt(String(r.count), 10),
    }));

    return {
      countries: countriesRaw.map((r) => ({
        country: String(r.country ?? ''),
        count: parseInt(String(r.count), 10),
      })),
      cities,
      districts: districtsRaw.map((r) => ({
        city: String(r.city ?? ''),
        district: String(r.district ?? ''),
        count: parseInt(String(r.count), 10),
      })),
    };
  }

  async getMonthlyTrend(
    months: number = 12,
    branchIds: string[] | null = null,
  ): Promise<MonthlyTrendEntry[]> {
    const now = new Date();
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
          .where('net.endedAt >= :start', { start })
          .andWhere('net.endedAt <= :endCap', { endCap })
          .andWhere('net.endedAt IS NOT NULL')
          .andWhere(
            branchIds && branchIds.length > 0
              ? 'net.branchId IN (:...branchIds)'
              : '1=1',
            { branchIds },
          )
          .getCount(),
        this.attendeeRepository
          .createQueryBuilder('attendee')
          .innerJoin('attendee.net', 'net')
          .select('COUNT(DISTINCT UPPER(TRIM(attendee.callSign)))', 'count')
          .where('net.endedAt >= :start', { start })
          .andWhere('net.endedAt <= :endCap', { endCap })
          .andWhere('net.endedAt IS NOT NULL')
          .andWhere(
            branchIds && branchIds.length > 0
              ? 'net.branchId IN (:...branchIds)'
              : '1=1',
            { branchIds },
          )
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
    branchIds: string[] | null = null,
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

    this.applyBranchFilter(qb, branchIds);

    const raw = await qb.getRawMany();
    const reversed = raw.reverse();
    return reversed.map((r) => ({
      endedAt:
        r.endedAt instanceof Date
          ? r.endedAt.toISOString()
          : String(r.endedAt ?? ''),
      attendeeCount: parseInt(String(r.attendeeCount ?? '0'), 10),
      netName: String(r.netName ?? ''),
    }));
  }

  private async calculateStreak(
    userId: string,
    branchIds: string[] | null = null,
  ): Promise<number> {
    const attendances = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoinAndSelect('attendee.net', 'net')
      .leftJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('net.endedAt IS NOT NULL')
      .andWhere(
        branchIds && branchIds.length > 0
          ? 'net.branchId IN (:...branchIds)'
          : '1=1',
        { branchIds },
      )
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
    return this.calculateStreak(userId, [branchId]);
  }

  private async calculateStreakForBranches(
    userId: string,
    branchIds: string[] | null,
  ): Promise<number> {
    return this.calculateStreak(userId, branchIds);
  }

  async getNetComparePrevious(
    netId: string,
  ): Promise<NetComparePreviousResponse | null> {
    const current = await this.netRepository.findOne({
      where: { id: netId },
      select: [
        'id',
        'branchId',
        'startedAt',
        'endedAt',
        'totalDurationMinutes',
      ],
    });
    if (!current?.branchId || !current.startedAt || !current.endedAt) {
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

    const currentDurationMinutes =
      current.totalDurationMinutes != null && current.totalDurationMinutes > 0
        ? current.totalDurationMinutes
        : Math.floor(
            (new Date(current.endedAt).getTime() -
              new Date(current.startedAt).getTime()) /
              60000,
          );
    const previousDurationMinutes =
      previous.totalDurationMinutes != null && previous.totalDurationMinutes > 0
        ? previous.totalDurationMinutes
        : Math.floor(
            (new Date(previous.endedAt).getTime() -
              new Date(previous.startedAt).getTime()) /
              60000,
          );

    return {
      previousAttendeeCount: previousCount,
      previousDurationMinutes,
      deltaAttendeeCount: currentCount - previousCount,
      deltaDurationMinutes: currentDurationMinutes - previousDurationMinutes,
      previousEndedAt: previous.endedAt.toISOString(),
    };
  }
}
