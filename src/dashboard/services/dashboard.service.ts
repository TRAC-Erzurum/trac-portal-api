import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Net } from '../../net/entities/net.entity';
import { Attendee } from '../../net/entities/attendee.entity';
import { Not, IsNull } from 'typeorm';
import { startCase } from 'lodash';

interface TopStat {
  title: string;
  icon: string;
  type: 'operator' | 'net';
  data: Array<
    | {
        userId: string;
        callSign: string;
        value: string;
      }
    | {
        netId: string;
        netName: string;
        operatorCallSign: string;
        value: string;
      }
  >;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    @InjectRepository(Attendee)
    private readonly attendeeRepository: Repository<Attendee>,
  ) {}

  async getPersonalStats(userId: string) {
    const attendedNets = await this.attendeeRepository.count({
      where: { operator: { user: { id: userId } } },
    });

    const managedNets = await this.netRepository.count({
      where: { operator: { user: { id: userId } } },
    });

    const lastAttendedNet = await this.attendeeRepository.findOne({
      where: { operator: { user: { id: userId } } },
      order: { createdAt: 'DESC' },
      relations: { net: true },
      select: {
        net: {
          id: true,
          name: true,
          startedAt: true,
        },
      },
    });

    const lastManagedNet = await this.netRepository.findOne({
      where: { operator: { user: { id: userId } } },
      order: { startedAt: 'DESC' },
      select: {
        id: true,
        name: true,
        startedAt: true,
      },
    });

    const attendances = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoinAndSelect('attendee.net', 'net')
      .leftJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('net.endedAt IS NOT NULL')
      .orderBy('net.endedAt', 'ASC')
      .getMany();

    const signalReadability = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .select([
        'ROUND(CAST(AVG(CAST(attendee.signalStrength AS DECIMAL(10,2))) AS DECIMAL(10,2))) as "avgSignal"',
        'ROUND(CAST(AVG(CAST(attendee.readability AS DECIMAL(10,2))) AS DECIMAL(10,2))) as "avgReadability"',
      ])
      .where('user.id = :userId', { userId })
      .getRawOne();

    return {
      attendedNets,
      managedNets,
      lastAttendedNet: lastAttendedNet?.net
        ? {
            id: lastAttendedNet.net.id,
            name: lastAttendedNet.net.name,
            date: lastAttendedNet.net.startedAt,
          }
        : null,
      lastManagedNet: lastManagedNet
        ? {
            id: lastManagedNet.id,
            name: lastManagedNet.name,
            date: lastManagedNet.startedAt,
          }
        : null,
      consecutiveRecord: this.calculateConsecutiveRecord(attendances),
      averageSignal: signalReadability?.avgSignal || 0,
      averageReadability: signalReadability?.avgReadability || 0,
    };
  }

  async getRecentNets() {
    const activeNets = await this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .loadRelationCountAndMap(
        'net.attendeeCount',
        'net.attendees',
        'attendee',
      )
      .where('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NULL')
      .orderBy('net.startedAt', 'DESC')
      .limit(6)
      .getMany();

    if (activeNets.length >= 6) {
      return activeNets;
    }

    const upcomingNets = await this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .loadRelationCountAndMap(
        'net.attendeeCount',
        'net.attendees',
        'attendee',
      )
      .where('net.startedAt IS NULL')
      .orderBy('net.createdAt', 'DESC')
      .limit(6 - activeNets.length)
      .getMany();

    const combinedNets = [...activeNets, ...upcomingNets];

    if (combinedNets.length >= 6) {
      return combinedNets.slice(0, 6);
    }

    const completedNets = await this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .loadRelationCountAndMap(
        'net.attendeeCount',
          'net.attendees',
        'attendee',
      )
      .where('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .orderBy('net.startedAt', 'DESC')
      .limit(6 - combinedNets.length)
      .getMany();

    return [...combinedNets, ...completedNets].slice(0, 6);
  }

  async getTopStats(): Promise<TopStat[]> {
    const topOperatorsByNet = await this.netRepository
      .createQueryBuilder('net')
      .leftJoin('net.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .select([
        'operator.id as operator_id',
        'operator.callSign as operator_callsign',
        'user.id as user_id',
        'COUNT(net.id) as value',
      ])
      .where('operator.id IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .groupBy('operator.id, operator.callSign, user.id')
      .having('COUNT(net.id) > 0')
      .orderBy('value', 'DESC')
      .limit(5)
      .getRawMany();

    const topOperatorsByParticipation = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .select([
        'operator.id as operator_id',
        'operator.callSign as operator_callsign',
        'user.id as user_id',
        'COUNT(attendee.id) as value',
      ])
      .where('operator.id IS NOT NULL')
      .groupBy('operator.id, operator.callSign, user.id')
      .having('COUNT(attendee.id) > 0')
      .orderBy('value', 'DESC')
      .limit(5)
      .getRawMany();

    const topOperatorsBySignal = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .select([
        'operator.id as operator_id',
        'operator.callSign as operator_callsign',
        'user.id as user_id',
        'ROUND(AVG(CAST(attendee.signalStrength AS DECIMAL))::numeric, 1) as value',
        'COUNT(*) as count',
      ])
      .where('attendee.signalStrength IS NOT NULL')
      .groupBy('operator.id')
      .addGroupBy('operator.callSign')
      .addGroupBy('user.id')
      .orderBy('value', 'DESC')
      .addOrderBy('count', 'DESC')
      .addOrderBy('operator.callSign', 'ASC')
      .limit(5)
      .getRawMany();

    const topOperatorsByReadability = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .select([
        'operator.id as operator_id',
        'operator.callSign as operator_callsign',
        'user.id as user_id',
        'ROUND(AVG(CAST(attendee.readability AS DECIMAL))::numeric, 1) as value',
        'COUNT(*) as count',
      ])
      .where('attendee.readability IS NOT NULL')
      .groupBy('operator.id')
      .addGroupBy('operator.callSign')
      .addGroupBy('user.id')
      .orderBy('value', 'DESC')
      .addOrderBy('count', 'DESC')
      .addOrderBy('operator.callSign', 'ASC')
      .limit(5)
      .getRawMany();

    const operatorAttendances = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .leftJoin('attendee.net', 'net')
      .select([
        'operator.id as operator_id',
        'operator.callSign as operator_callsign',
        'user.id as user_id',
        'net.endedAt as net_date',
      ])
      .where('operator.id IS NOT NULL')
      .andWhere('net.endedAt IS NOT NULL')
      .orderBy('operator.id', 'ASC')
      .addOrderBy('net.endedAt', 'ASC')
      .getRawMany();

    const operatorStreaks = new Map();
    let currentOperatorId = null;
    let currentStreak = 1;
    let maxStreak = 1;

    operatorAttendances.forEach((attendance, index) => {
      if (currentOperatorId !== attendance.operator_id) {
        if (currentOperatorId) {
          operatorStreaks.set(currentOperatorId, {
            streak: maxStreak,
            callSign: operatorAttendances[index - 1].operator_callsign,
            userId: operatorAttendances[index - 1].user_id,
          });
        }
        currentOperatorId = attendance.operator_id;
        currentStreak = 1;
        maxStreak = 1;
      } else if (index > 0) {
        const prevDate = new Date(operatorAttendances[index - 1].net_date);
        const currDate = new Date(attendance.net_date);
        const daysDiff =
          (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 7) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 1;
        }
      }
    });

    if (currentOperatorId && operatorAttendances.length > 0) {
      const lastAttendance =
        operatorAttendances[operatorAttendances.length - 1];
      operatorStreaks.set(currentOperatorId, {
        streak: maxStreak,
        callSign: lastAttendance.operator_callsign,
        userId: lastAttendance.user_id,
      });
    }

    const topOperatorsByStreak = Array.from(operatorStreaks.values())
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 5)
      .map((op) => ({
        userId: op.userId,
        callSign: op.callSign,
        value: `${op.streak} çevrim`,
      }));

    const topNetsByParticipants = await this.netRepository
      .createQueryBuilder('net')
      .leftJoin('net.operator', 'operator')
      .leftJoin('net.attendees', 'attendee')
      .select([
        'net.id as net_id',
        'net.name as net_name',
        'operator.callSign as operator_callsign',
        'COUNT(DISTINCT attendee.id) as value',
      ])
      .groupBy('net.id')
      .addGroupBy('net.name')
      .addGroupBy('operator.callSign')
      .orderBy('value', 'DESC')
      .limit(5)
      .getRawMany();

    const topActiveCities = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .select('TRIM(attendee.city)', 'city')
      .addSelect('COUNT(attendee.id)', 'value')
      .where('attendee.city IS NOT NULL')
      .andWhere("TRIM(attendee.city) != ''")
      .groupBy('TRIM(attendee.city)')
      .orderBy('value', 'DESC')
      .limit(5)
      .getRawMany();

    return [
      {
        title: 'pages.dashboard.topNetsByParticipants',
        icon: 'mdi-account-multiple',
        type: 'net',
        data: topNetsByParticipants.map((net) => ({
          netId: net.net_id,
          netName: net.net_name,
          operatorCallSign: net.operator_callsign,
          value: `${net.value} katılımcı`,
        })),
      },
      {
        title: 'pages.dashboard.topActiveCities',
        icon: 'mdi-city',
        type: 'net',
        data: topActiveCities.map((city) => ({
          netId: null,
          netName: startCase(city.city),
          operatorCallSign: null,
          value: `${city.value} katılım`,
        })),
      },
      {
        title: 'pages.dashboard.topOperatorsByNet',
        icon: 'mdi-account-star',
        type: 'operator',
        data: topOperatorsByNet.map((op) => ({
          userId: op.user_id,
          callSign: op.operator_callsign,
          value: `${op.value} çevrim`,
        })),
      },
      {
        title: 'pages.dashboard.topOperatorsByParticipation',
        icon: 'mdi-account-group',
        type: 'operator',
        data: topOperatorsByParticipation.map((op) => ({
          userId: op.user_id,
          callSign: op.operator_callsign,
          value: `${op.value} çevrim`,
        })),
      },
      {
        title: 'pages.dashboard.topOperatorsByStreak',
        icon: 'mdi-trophy-outline',
        type: 'operator',
        data: topOperatorsByStreak,
      },
      {
        title: 'pages.dashboard.topOperatorsByReadability',
        icon: 'mdi-read',
        type: 'operator',
        data: topOperatorsByReadability.map((op) => ({
          userId: op.user_id,
          callSign: op.operator_callsign,
          value: `${op.value}/5 (${op.count} çevrim)`,
        })),
      },
      {
        title: 'pages.dashboard.topOperatorsBySignal',
        icon: 'mdi-signal',
        type: 'operator',
        data: topOperatorsBySignal.map((op) => ({
          userId: op.user_id,
          callSign: op.operator_callsign,
          value: `${op.value}/9 (${op.count} çevrim)`,
        })),
      },
    ];
  }

  private calculateConsecutiveRecord(attendances: Attendee[]): number {
    const filteredAttendances = attendances.filter(
      (attendance) => attendance.net?.endedAt != null
    );

    if (!filteredAttendances.length) return 0;

    const sortedAttendances = [...filteredAttendances].sort((a, b) => {
      const dateA = a.net.endedAt ? new Date(a.net.endedAt).getTime() : 0;
      const dateB = b.net.endedAt ? new Date(b.net.endedAt).getTime() : 0;
      return dateA - dateB;
    });

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sortedAttendances.length; i++) {
      const prevDate = new Date(sortedAttendances[i - 1].net.endedAt);
      const currDate = new Date(sortedAttendances[i].net.endedAt);

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

  async getNetStats() {
    const [totalNets, totalAttendees, averageAttendees] = await Promise.all(
      [
        this.netRepository.count({
          where: {
            startedAt: Not(IsNull()),
          },
        }),

        this.attendeeRepository
          .createQueryBuilder('attendee')
          .innerJoin('attendee.net', 'net')
          .where('net.startedAt IS NOT NULL')
          .getCount(),

        this.netRepository
            .createQueryBuilder('net')
          .select('ROUND(AVG(attendee_count)::numeric, 1)', 'average')
          .from((subQuery) => {
            return subQuery
              .select([
                'net.id',
                'COUNT(DISTINCT attendee.id) as attendee_count',
              ])
              .from('nets', 'net')
              .leftJoin(
                'attendees',
                'attendee',
                'attendee.netId = net.id',
              )
              .where('net.startedAt IS NOT NULL')
              .groupBy('net.id');
          }, 'net_stats')
          .getRawOne(),
      ],
    );

    return {
      totalNets,
      totalAttendees,
      averageAttendees: averageAttendees?.average || 0,
    };
  }
}
