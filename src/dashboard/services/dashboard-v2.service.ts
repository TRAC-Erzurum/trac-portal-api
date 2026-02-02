import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Net } from '../../net/entities/net.entity';
import { Attendee } from '../../net/entities/attendee.entity';
import { Operator } from '../../operator/entities/operator.entity';
import { Activity } from '../../activity/entities/activity.entity';

export interface StatusResponse {
  activeNetsCount: number;
  hasActiveNets: boolean;
}

export interface ActiveNet {
  id: string;
  name: string;
  frequency: string;
  mode: string;
  operatorCallSign: string;
  attendeeCount: number;
  startedAt: Date;
  durationMinutes: number;
}

export interface PendingNet {
  id: string;
  name: string;
  frequency: string;
  mode: string;
  operatorCallSign: string;
}

export interface PersonalNetStats {
  attendedNets: number;
  managedNets: number;
  streak: number;
  averageReadability: number;
  averageSignal: number;
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
  monthlyStats: MonthlyStats[];
  topParticipants: LeaderboardEntry[];
  topNetManagers: LeaderboardEntry[];
  topNets: LeaderboardEntry[];
}

@Injectable()
export class DashboardV2Service {
  constructor(
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    @InjectRepository(Attendee)
    private readonly attendeeRepository: Repository<Attendee>,
    @InjectRepository(Operator)
    private readonly operatorRepository: Repository<Operator>,
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
  ) {}

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

  async getActiveNets(limit: number = 5): Promise<ActiveNet[]> {
    const nets = await this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .loadRelationCountAndMap('net.attendeeCount', 'net.attendees')
      .where('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NULL')
      .orderBy('net.startedAt', 'DESC')
      .limit(limit)
      .getMany();

    const now = new Date();

    return nets.map((net) => ({
      id: net.id,
      name: net.name,
      frequency: net.frequency,
      mode: net.mode,
      operatorCallSign: net.operator?.callSign || 'Unknown',
      attendeeCount: (net as any).attendeeCount || 0,
      startedAt: net.startedAt,
      durationMinutes: net.startedAt
        ? Math.floor((now.getTime() - new Date(net.startedAt).getTime()) / 60000)
        : 0,
    }));
  }

  async getPendingNets(limit: number = 5): Promise<PendingNet[]> {
    const nets = await this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .where('net.startedAt IS NULL')
      .orderBy('net.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return nets.map((net) => ({
      id: net.id,
      name: net.name,
      frequency: net.frequency,
      mode: net.mode,
      operatorCallSign: net.operator?.callSign || 'Unknown',
    }));
  }

  async getRecentCompletedNets(limit: number = 3): Promise<ActiveNet[]> {
    const nets = await this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .loadRelationCountAndMap('net.attendeeCount', 'net.attendees')
      .where('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .orderBy('net.endedAt', 'DESC')
      .limit(limit)
      .getMany();

    return nets.map((net) => {
      const duration = net.startedAt && net.endedAt
        ? Math.floor((new Date(net.endedAt).getTime() - new Date(net.startedAt).getTime()) / 60000)
        : 0;

      return {
        id: net.id,
        name: net.name,
        frequency: net.frequency,
        mode: net.mode,
        operatorCallSign: net.operator?.callSign || 'Unknown',
        attendeeCount: (net as any).attendeeCount || 0,
        startedAt: net.startedAt,
        durationMinutes: duration,
      };
    });
  }

  async getPersonalNetStats(userId: string): Promise<PersonalNetStats> {
    const [attendedNets, managedNets, signalReadability, streak] = await Promise.all([
      this.attendeeRepository.count({
        where: { operator: { user: { id: userId } } },
      }),
      this.netRepository.count({
        where: { operator: { user: { id: userId } } },
      }),
      this.attendeeRepository
        .createQueryBuilder('attendee')
        .leftJoin('attendee.operator', 'operator')
        .leftJoin('operator.user', 'user')
        .select([
          'ROUND(CAST(AVG(CAST(attendee.signalStrength AS DECIMAL(10,2))) AS DECIMAL(10,2))) as "avgSignal"',
          'ROUND(CAST(AVG(CAST(attendee.readability AS DECIMAL(10,2))) AS DECIMAL(10,2))) as "avgReadability"',
        ])
        .where('user.id = :userId', { userId })
        .getRawOne(),
      this.calculateStreak(userId),
    ]);

    return {
      attendedNets,
      managedNets,
      streak,
      averageReadability: signalReadability?.avgReadability || 0,
      averageSignal: signalReadability?.avgSignal || 0,
    };
  }

  async getCommunityStats(): Promise<CommunityStats> {
    const now = new Date();

    const last3Months = this.getLast3Months(now);

    const [
      totalUniqueParticipantsResult,
      totalCompletedNetsResult,
      monthlyStatsRaw,
      topParticipantsRaw,
      topNetManagersRaw,
      topNetsRaw,
    ] = await Promise.all([
      this.attendeeRepository
        .createQueryBuilder('attendee')
        .select('COUNT(DISTINCT UPPER(TRIM(attendee.callSign)))', 'count')
        .getRawOne(),

      this.netRepository
        .createQueryBuilder('net')
        .where('net.startedAt IS NOT NULL')
        .andWhere('net.endedAt IS NOT NULL')
        .getCount(),

      this.getMonthlyStats(last3Months),

      this.attendeeRepository
        .createQueryBuilder('attendee')
        .leftJoin('attendee.operator', 'operator')
        .leftJoin('operator.user', 'user')
        .select([
          'UPPER(TRIM(attendee.callSign)) as "callSign"',
          'operator.id as "operatorId"',
          'user.picture as "picture"',
          'COUNT(attendee.id) as value',
        ])
        .groupBy('UPPER(TRIM(attendee.callSign))')
        .addGroupBy('operator.id')
        .addGroupBy('user.picture')
        .orderBy('value', 'DESC')
        .limit(5)
        .getRawMany(),

      this.netRepository
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
        .limit(5)
        .getRawMany(),

      this.netRepository
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
        .limit(5)
        .getRawMany(),
    ]);

    const topParticipants: LeaderboardEntry[] = topParticipantsRaw.map(
      (op, index) => ({
        rank: index + 1,
        callSign: op.callSign,
        operatorId: op.operatorId || null,
        picture: op.picture || null,
        value: parseInt(op.value, 10),
        label: 'attendance',
      }),
    );

    const topNetManagers: LeaderboardEntry[] = topNetManagersRaw.map(
      (op, index) => ({
        rank: index + 1,
        callSign: op.callSign,
        operatorId: op.operatorId || null,
        picture: op.picture || null,
        value: parseInt(op.value, 10),
        label: 'nets',
      }),
    );

    const topNets: LeaderboardEntry[] = topNetsRaw.map((net, index) => ({
      rank: index + 1,
      callSign: net.name,
      netId: net.netId || null,
      value: parseInt(net.value, 10),
      label: 'attendees',
    }));

    return {
      totalUniqueParticipants: parseInt(
        totalUniqueParticipantsResult?.count || '0',
        10,
      ),
      totalCompletedNets: totalCompletedNetsResult,
      monthlyStats: monthlyStatsRaw,
      topParticipants,
      topNetManagers,
      topNets,
    };
  }

  private getLast3Months(now: Date): { start: Date; end: Date; month: number; year: number }[] {
    const months: { start: Date; end: Date; month: number; year: number }[] = [];

    for (let i = 0; i < 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

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
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
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
        totalAttendees: parseInt(attendeesData?.totalAttendees || '0', 10),
        uniqueParticipants: parseInt(attendeesData?.uniqueParticipants || '0', 10),
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
        { userId }
      );
    }

    return query.getMany();
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
      const daysDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff <= 7) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return maxStreak;
  }
}
