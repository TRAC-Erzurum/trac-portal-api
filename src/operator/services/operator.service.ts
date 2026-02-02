import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, IsNull, Not, Repository } from 'typeorm';
import { Operator } from '../entities/operator.entity';
import { Attendee } from '../../net/entities/attendee.entity';
import { Net } from '../../net/entities/net.entity';
import { chunk, startCase } from 'lodash';
import { OperatorQueryDto } from '../dto/operator-query.dto';

export interface OperatorStats {
  attendedNets: number;
  managedNets: number;
  streak: number;
  averageReadability: number;
  averageSignal: number;
}

export interface OperatorNetItem {
  id: string;
  name: string;
  date: Date;
  role: 'attended' | 'managed';
  attendeeCount?: number;
}

@Injectable()
export class OperatorService {
  constructor(
    @InjectRepository(Operator)
    private readonly operatorRepository: Repository<Operator>,
    @InjectRepository(Attendee)
    private readonly attendeeRepository: Repository<Attendee>,
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
  ) {}

  async find(
    query: OperatorQueryDto,
  ): Promise<{ data: Operator[]; total: number }> {
    const baseQueryBuilder = this.operatorRepository
      .createQueryBuilder('operator')
      .leftJoinAndSelect('operator.user', 'user');

    if (query.search) {
      const searchTerm = `%${query.search.toLowerCase()}%`;
      baseQueryBuilder.where(
        '(LOWER(operator.callSign) LIKE :search OR ' +
          'LOWER(operator.fullName) LIKE :search OR ' +
          'LOWER(operator.country) LIKE :search OR ' +
          'LOWER(operator.city) LIKE :search OR ' +
          'LOWER(operator.district) LIKE :search OR ' +
          'LOWER(user.fullName) LIKE :search)',
        { search: searchTerm },
      );
    }

    const total = await baseQueryBuilder.getCount();

    const data = await baseQueryBuilder
      .addSelect(
        'CASE WHEN "user"."id" IS NULL THEN 1 ELSE 0 END',
        'user_sort_priority',
      )
      .orderBy('user_sort_priority', 'ASC')
      .addOrderBy('operator.createdAt', 'ASC')
      .addOrderBy('operator.callSign', 'ASC')
      .skip((query.pageNumber - 1) * query.pageSize)
      .take(query.pageSize)
      .getMany();

    return { data, total };
  }

  async findWithStats(
    query: OperatorQueryDto,
  ): Promise<{ data: (Operator & { attendedCount: number; managedCount: number })[]; total: number }> {
    const baseQueryBuilder = this.operatorRepository
      .createQueryBuilder('operator')
      .leftJoinAndSelect('operator.user', 'user')
      .leftJoin('operator.attendees', 'attendee')
      .leftJoin('operator.nets', 'net', 'net.endedAt IS NOT NULL')
      .addSelect('COUNT(DISTINCT attendee.id)', 'attendedCount')
      .addSelect('COUNT(DISTINCT net.id)', 'managedCount')
      .groupBy('operator.id')
      .addGroupBy('user.id');

    if (query.search) {
      const searchTerm = `%${query.search.toLowerCase()}%`;
      baseQueryBuilder.andWhere(
        '(LOWER(operator.callSign) LIKE :search OR ' +
          'LOWER(operator.fullName) LIKE :search OR ' +
          'LOWER(operator.country) LIKE :search OR ' +
          'LOWER(operator.city) LIKE :search OR ' +
          'LOWER(operator.district) LIKE :search OR ' +
          'LOWER(user.fullName) LIKE :search)',
        { search: searchTerm },
      );
    }

    if (query.membership === 'registered') {
      baseQueryBuilder.andWhere('user.id IS NOT NULL');
    } else if (query.membership === 'unregistered') {
      baseQueryBuilder.andWhere('user.id IS NULL');
    }

    if (query.role && query.role !== 'all') {
      baseQueryBuilder.andWhere('user.role = :role', { role: query.role });
    }

    const countQuery = this.operatorRepository
      .createQueryBuilder('operator')
      .leftJoin('operator.user', 'user');

    if (query.search) {
      const searchTerm = `%${query.search.toLowerCase()}%`;
      countQuery.andWhere(
        '(LOWER(operator.callSign) LIKE :search OR ' +
          'LOWER(operator.fullName) LIKE :search OR ' +
          'LOWER(operator.country) LIKE :search OR ' +
          'LOWER(operator.city) LIKE :search OR ' +
          'LOWER(operator.district) LIKE :search OR ' +
          'LOWER(user.fullName) LIKE :search)',
        { search: searchTerm },
      );
    }

    if (query.membership === 'registered') {
      countQuery.andWhere('user.id IS NOT NULL');
    } else if (query.membership === 'unregistered') {
      countQuery.andWhere('user.id IS NULL');
    }

    if (query.role && query.role !== 'all') {
      countQuery.andWhere('user.role = :role', { role: query.role });
    }

    const total = await countQuery.getCount();

    const rawAndEntities = await baseQueryBuilder
      .addSelect('CASE WHEN user.id IS NOT NULL THEN 0 ELSE 1 END', 'user_priority')
      .orderBy('CASE WHEN user.id IS NOT NULL THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('operator.callSign', 'ASC')
      .offset((query.pageNumber - 1) * query.pageSize)
      .limit(query.pageSize)
      .getRawAndEntities();

    const data = rawAndEntities.entities.map((entity, idx) => ({
      ...entity,
      attendedCount: parseInt(rawAndEntities.raw[idx]?.attendedCount || '0', 10),
      managedCount: parseInt(rawAndEntities.raw[idx]?.managedCount || '0', 10),
    }));

    return { data, total };
  }

  async findAllWithUser(): Promise<Operator[]> {
    return this.operatorRepository.find({
      where: { user: Not(IsNull()) },
      relations: { user: true },
    });
  }

  async findOne(id: string): Promise<Operator> {
    const operator = await this.operatorRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!operator) {
      throw new NotFoundException(`Operator with ID ${id} not found`);
    }
    return operator;
  }

  async findByCallSign(callSign: string): Promise<Operator | null> {
    return this.operatorRepository.findOne({
      where: { callSign: callSign.toUpperCase() },
      relations: { user: true },
    });
  }

  async create(
    operatorData: DeepPartial<Operator>,
    createdBy: string,
  ): Promise<Operator> {
    const existingOperator = await this.operatorRepository.findOne({
      where: { callSign: operatorData.callSign },
      relations: { user: true },
    });

    if (!existingOperator) {
      const operator = this.operatorRepository.create({
        ...operatorData,
        createdBy,
        updatedBy: [],
      });
      return this.operatorRepository.save(operator);
    }

    if (existingOperator.user) {
      throw new ForbiddenException('error.operatorAlreadyExists');
    }

    Object.assign(existingOperator, {
      ...operatorData,
      createdBy,
      updatedBy: [],
    });
    return this.operatorRepository.save(existingOperator);
  }

  async update(
    id: string,
    operatorData: DeepPartial<Operator>,
    updatedBy: string,
  ): Promise<Operator> {
    const operator = await this.operatorRepository.findOne({ where: { id } });
    if (!operator) {
      throw new NotFoundException(`Operator with ID ${id} not found`);
    }
    Object.assign(operator, {
      ...operatorData,
      updatedBy: [...(operator.updatedBy || []), updatedBy],
    });
    return this.operatorRepository.save(operator);
  }

  async import(
    records: Record<string, string>[],
    createdBy: string,
  ): Promise<void> {
    const operators = records
      .filter((record) => record.callSign)
      .map((record) => {
        const operator = new Operator();
        operator.callSign = record.callSign.toUpperCase();
        operator.prefix = record.prefix;
        operator.suffix = record.suffix;
        operator.country = startCase(record.country);
        operator.city = startCase(record.city);
        operator.district = startCase(record.district);
        operator.gridSquare = record.gridSquare;
        operator.fullName = startCase(record.fullName);
        operator.createdBy = createdBy;
        operator.updatedBy = [];
        return operator;
      });

    const batchSize = 100;

    for (const operator of chunk(operators, batchSize)) {
      await this.operatorRepository
        .createQueryBuilder()
        .insert()
        .into(Operator)
        .values(operator)
        .orIgnore()
        .execute();
    }
  }

  async search(
    query: string,
    sortBy: 'managed' | 'attended' | 'default' = 'default',
    limit: number = 10,
  ): Promise<Operator[]> {
    const searchTerm = `%${query.toLowerCase()}%`;

    const qb = this.operatorRepository
      .createQueryBuilder('operator')
      .leftJoinAndSelect('operator.user', 'user')
      .where(
        '(LOWER(operator.callSign) LIKE :search OR ' +
          'LOWER(operator.fullName) LIKE :search OR ' +
          'LOWER(operator.city) LIKE :search OR ' +
          'LOWER(operator.district) LIKE :search OR ' +
          'LOWER(user.fullName) LIKE :search)',
        { search: searchTerm },
      );

    if (sortBy === 'managed') {
      qb.leftJoin('operator.nets', 'net')
        .addSelect('COUNT(DISTINCT net.id)', 'managedCount')
        .addSelect('MAX(net.endedAt)', 'lastNetDate')
        .groupBy('operator.id')
        .addGroupBy('user.id')
        .orderBy('COUNT(DISTINCT net.id)', 'DESC')
        .addOrderBy('MAX(net.endedAt)', 'DESC', 'NULLS LAST')
        .addOrderBy('operator.callSign', 'ASC');

      const result = await qb.limit(limit).getRawAndEntities();
      return result.entities;
    } else if (sortBy === 'attended') {
      qb.leftJoin('operator.attendees', 'attendee')
        .addSelect('COUNT(DISTINCT attendee.id)', 'attendedCount')
        .groupBy('operator.id')
        .addGroupBy('user.id')
        .orderBy('COUNT(DISTINCT attendee.id)', 'DESC')
        .addOrderBy('operator.callSign', 'ASC');

      const result = await qb.limit(limit).getRawAndEntities();
      return result.entities;
    } else {
      qb.orderBy('operator.callSign', 'ASC');
      return qb.limit(limit).getMany();
    }
  }

  async delete(id: string): Promise<void> {
    const operator = await this.operatorRepository.findOne({
      where: { id },
      relations: { user: true, attendees: true },
    });
    if (!operator) {
      throw new NotFoundException(`${id} ile eşleşen bir kayıt bulunamadı`);
    }

    if (operator.user) {
      throw new BadRequestException(
        `${operator.callSign} için bir kullanıcı bulunduğu için silinemez`,
      );
    }

    if (operator.attendees.length > 0) {
      throw new BadRequestException(
        `${operator.callSign} en az bir çevrime katıldığı için silinemez`,
      );
    }

    await this.operatorRepository.delete(id);
  }

  async getStats(id: string): Promise<OperatorStats> {
    const operator = await this.findOne(id);

    const [attendedNets, managedNets, signalReadability, streak] =
      await Promise.all([
        this.attendeeRepository.count({
          where: { operator: { id } },
        }),

        this.netRepository.count({
          where: {
            operator: { id },
            startedAt: Not(IsNull()),
            endedAt: Not(IsNull()),
          },
        }),

        this.attendeeRepository
          .createQueryBuilder('attendee')
          .select([
            'ROUND(AVG(attendee.signalStrength)::numeric, 1) as "avgSignal"',
            'ROUND(AVG(attendee.readability)::numeric, 1) as "avgReadability"',
          ])
          .where('attendee.operatorId = :id', { id })
          .andWhere('attendee.signalStrength IS NOT NULL')
          .getRawOne(),

        this.calculateStreak(id),
      ]);

    return {
      attendedNets,
      managedNets,
      streak,
      averageReadability: parseFloat(signalReadability?.avgReadability) || 0,
      averageSignal: parseFloat(signalReadability?.avgSignal) || 0,
    };
  }

  async getRecentNets(id: string, limit: number = 10, offset: number = 0): Promise<OperatorNetItem[]> {
    const fetchLimit = limit + offset + 50;
    
    const [attendedNets, managedNets] = await Promise.all([
      this.attendeeRepository
        .createQueryBuilder('attendee')
        .leftJoinAndSelect('attendee.net', 'net')
        .where('attendee.operatorId = :id', { id })
        .andWhere('net.endedAt IS NOT NULL')
        .orderBy('net.endedAt', 'DESC')
        .limit(fetchLimit)
        .getMany(),

      this.netRepository
        .createQueryBuilder('net')
        .leftJoin('net.attendees', 'attendee')
        .addSelect('COUNT(attendee.id)', 'attendeeCount')
        .where('net.operatorId = :id', { id })
        .andWhere('net.endedAt IS NOT NULL')
        .groupBy('net.id')
        .orderBy('net.endedAt', 'DESC')
        .limit(fetchLimit)
        .getRawAndEntities(),
    ]);

    const attended: OperatorNetItem[] = attendedNets.map((a) => ({
      id: a.net.id,
      name: a.net.name,
      date: a.net.endedAt,
      role: 'attended' as const,
    }));

    const managed: OperatorNetItem[] = managedNets.entities.map((net, idx) => ({
      id: net.id,
      name: net.name,
      date: net.endedAt,
      role: 'managed' as const,
      attendeeCount: parseInt(managedNets.raw[idx]?.attendeeCount || '0', 10),
    }));

    const all = [...attended, ...managed]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const uniqueNets = new Map<string, OperatorNetItem>();
    for (const net of all) {
      if (!uniqueNets.has(net.id)) {
        uniqueNets.set(net.id, net);
      } else {
        const existing = uniqueNets.get(net.id)!;
        if (net.role === 'managed') {
          uniqueNets.set(net.id, { ...net, role: 'managed' });
        }
      }
    }

    return Array.from(uniqueNets.values()).slice(offset, offset + limit);
  }

  private async calculateStreak(operatorId: string): Promise<number> {
    const attendances = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoinAndSelect('attendee.net', 'net')
      .where('attendee.operatorId = :operatorId', { operatorId })
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
}
