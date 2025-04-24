import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../../session/entities/session.entity';
import { Attendee } from '../../session/entities/attendee.entity';
import { Not, IsNull } from 'typeorm';
import { startCase } from 'lodash';

interface TopStat {
  title: string;
  icon: string;
  type: 'operator' | 'session';
  data: Array<
    | {
        userId: string;
        callSign: string;
        value: string;
      }
    | {
        sessionId: string;
        sessionName: string;
        operatorCallSign: string;
        value: string;
      }
  >;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Attendee)
    private readonly attendeeRepository: Repository<Attendee>,
  ) {}

  async getPersonalStats(userId: string) {
    const attendedSessions = await this.attendeeRepository.count({
      where: { operator: { user: { id: userId } } },
    });

    const managedSessions = await this.sessionRepository.count({
      where: { operator: { user: { id: userId } } },
    });

    const lastAttendedSession = await this.attendeeRepository.findOne({
      where: { operator: { user: { id: userId } } },
      order: { createdAt: 'DESC' },
      relations: { session: true },
      select: {
        session: {
          id: true,
          name: true,
          startedAt: true,
        },
      },
    });

    const lastManagedSession = await this.sessionRepository.findOne({
      where: { operator: { user: { id: userId } } },
      order: { startedAt: 'DESC' },
      select: {
        id: true,
        name: true,
        startedAt: true,
      },
    });

    const attendances = await this.attendeeRepository.find({
      where: { operator: { user: { id: userId } } },
      order: { createdAt: 'ASC' },
      relations: { session: true },
    });

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
      attendedSessions,
      managedSessions,
      lastAttendedSession: lastAttendedSession?.session
        ? {
            id: lastAttendedSession.session.id,
            name: lastAttendedSession.session.name,
            date: lastAttendedSession.session.startedAt,
          }
        : null,
      lastManagedSession: lastManagedSession
        ? {
            id: lastManagedSession.id,
            name: lastManagedSession.name,
            date: lastManagedSession.startedAt,
          }
        : null,
      consecutiveRecord: this.calculateConsecutiveRecord(attendances),
      averageSignal: signalReadability?.avgSignal || 0,
      averageReadability: signalReadability?.avgReadability || 0,
    };
  }

  async getRecentSessions() {
    const activeSessions = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .loadRelationCountAndMap(
        'session.attendeeCount',
        'session.attendees',
        'attendee',
      )
      .where('session.startedAt IS NOT NULL')
      .andWhere('session.endedAt IS NULL')
      .orderBy('session.startedAt', 'DESC')
      .limit(5)
      .getMany();

    if (activeSessions.length >= 5) {
      return activeSessions;
    }

    const upcomingSessions = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .loadRelationCountAndMap(
        'session.attendeeCount',
        'session.attendees',
        'attendee',
      )
      .where('session.startedAt IS NULL')
      .orderBy('session.createdAt', 'DESC')
      .limit(5 - activeSessions.length)
      .getMany();

    const combinedSessions = [...activeSessions, ...upcomingSessions];

    if (combinedSessions.length >= 5) {
      return combinedSessions.slice(0, 5);
    }

    const completedSessions = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .loadRelationCountAndMap(
        'session.attendeeCount',
        'session.attendees',
        'attendee',
      )
      .where('session.startedAt IS NOT NULL')
      .andWhere('session.endedAt IS NOT NULL')
      .orderBy('session.startedAt', 'DESC')
      .limit(5 - combinedSessions.length)
      .getMany();

    return [...combinedSessions, ...completedSessions].slice(0, 5);
  }

  async getTopStats(): Promise<TopStat[]> {
    const topOperatorsBySession = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoin('session.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .select([
        'operator.id as operator_id',
        'operator.callSign as operator_callsign',
        'user.id as user_id',
        'COUNT(session.id) as value',
      ])
      .where('operator.id IS NOT NULL')
      .groupBy('operator.id, operator.callSign, user.id')
      .having('COUNT(session.id) > 0')
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
      .limit(5)
      .getRawMany();

    const operatorAttendances = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoin('attendee.operator', 'operator')
      .leftJoin('operator.user', 'user')
      .leftJoin('attendee.session', 'session')
      .select([
        'operator.id as operator_id',
        'operator.callSign as operator_callsign',
        'user.id as user_id',
        'session.startedAt as session_date',
      ])
      .where('operator.id IS NOT NULL')
      .orderBy('operator.id', 'ASC')
      .addOrderBy('session.startedAt', 'ASC')
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
        const prevDate = new Date(operatorAttendances[index - 1].session_date);
        const currDate = new Date(attendance.session_date);
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

    const topSessionsByParticipants = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoin('session.operator', 'operator')
      .leftJoin('session.attendees', 'attendee')
      .select([
        'session.id as session_id',
        'session.name as session_name',
        'operator.callSign as operator_callsign',
        'COUNT(DISTINCT attendee.id) as value',
      ])
      .groupBy('session.id')
      .addGroupBy('session.name')
      .addGroupBy('operator.callSign')
      .orderBy('value', 'DESC')
      .limit(5)
      .getRawMany();

    const topActiveCities = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .select([
        'LOWER(attendee.city) as city_lower',
        'MAX(attendee.city) as city',
        'COUNT(attendee.id) as value',
      ])
      .where('attendee.city IS NOT NULL')
      .andWhere("attendee.city != ''")
      .groupBy('LOWER(attendee.city)')
      .orderBy('value', 'DESC')
      .limit(5)
      .getRawMany();

    return [
      {
        title: 'pages.dashboard.topSessionsByParticipants',
        icon: 'mdi-account-multiple',
        type: 'session',
        data: topSessionsByParticipants.map((session) => ({
          sessionId: session.session_id,
          sessionName: session.session_name,
          operatorCallSign: session.operator_callsign,
          value: `${session.value} katılımcı`,
        })),
      },
      {
        title: 'pages.dashboard.topActiveCities',
        icon: 'mdi-city',
        type: 'session',
        data: topActiveCities.map((city) => ({
          sessionId: null,
          sessionName: startCase(city.city),
          operatorCallSign: null,
          value: `${city.value} katılım`,
        })),
      },
      {
        title: 'pages.dashboard.topOperatorsBySession',
        icon: 'mdi-account-star',
        type: 'operator',
        data: topOperatorsBySession.map((op) => ({
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
    if (!attendances.length) return 0;

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < attendances.length; i++) {
      const prevDate = new Date(attendances[i - 1].session.startedAt);
      const currDate = new Date(attendances[i].session.startedAt);

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

  async getSessionStats() {
    const [totalSessions, totalAttendees, averageAttendees] = await Promise.all(
      [
        this.sessionRepository.count({
          where: {
            startedAt: Not(IsNull()),
          },
        }),

        this.attendeeRepository
          .createQueryBuilder('attendee')
          .innerJoin('attendee.session', 'session')
          .where('session.startedAt IS NOT NULL')
          .getCount(),

        this.sessionRepository
          .createQueryBuilder('session')
          .select('ROUND(AVG(attendee_count)::numeric, 1)', 'average')
          .from((subQuery) => {
            return subQuery
              .select([
                'session.id',
                'COUNT(DISTINCT attendee.id) as attendee_count',
              ])
              .from('sessions', 'session')
              .leftJoin(
                'attendees',
                'attendee',
                'attendee.sessionId = session.id',
              )
              .where('session.startedAt IS NOT NULL')
              .groupBy('session.id');
          }, 'session_stats')
          .getRawOne(),
      ],
    );

    return {
      totalSessions,
      totalAttendees,
      averageAttendees: averageAttendees?.average || 0,
    };
  }
}
