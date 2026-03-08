import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, IsNull, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { Operator } from '../entities/operator.entity';
import { Attendee } from '../../net/entities/attendee.entity';
import { Net } from '../../net/entities/net.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { UserBranchMembership } from '../../branch/entities/user-branch-membership.entity';
import { NetScheduler } from '../../net-scheduler/entities/net-scheduler.entity';
import { MembershipStatus } from '../../branch/enums/membership-status.enum';
import { chunk } from 'lodash';
import { toTitleCase } from '../../shared/utils/string.utils';
import { normalizeTurkishSearchTerm } from '../../shared/utils/turkish-search.util';
import { OperatorQueryDto } from '../dto/operator-query.dto';

export interface OperatorSearchResult extends Operator {
  isBranchMember: boolean;
}

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

export interface RelevanceContext {
  selfOperatorId: string | null;
  city: string | null;
  district: string | null;
  callSignRegion: string | null;
  userNonHqBranchIds: string[];
}

@Injectable()
export class OperatorService {
  private contextCache = new Map<
    string,
    { data: RelevanceContext; expiresAt: number }
  >();

  constructor(
    @InjectRepository(Operator)
    private readonly operatorRepository: Repository<Operator>,
    @InjectRepository(Attendee)
    private readonly attendeeRepository: Repository<Attendee>,
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserBranchMembership)
    private readonly membershipRepository: Repository<UserBranchMembership>,
    @InjectRepository(NetScheduler)
    private readonly netSchedulerRepository: Repository<NetScheduler>,
  ) {}

  // ── Relevance helpers ──────────────────────────────────────────────

  private async getUserRelevanceContext(
    userId: string,
  ): Promise<RelevanceContext> {
    // 1. Get the user's operator record
    const userOperator = await this.operatorRepository.findOne({
      where: { user: { id: userId } },
    });

    // 2. Get user's non-HQ branch IDs
    let userNonHqBranchIds: string[] = [];
    const memberships = await this.membershipRepository.find({
      where: { userId, status: MembershipStatus.APPROVED },
      select: ['branchId'],
    });
    if (memberships.length > 0) {
      const branchIds = memberships.map((m) => m.branchId);
      const nonHqBranches = await this.branchRepository
        .createQueryBuilder('branch')
        .select('branch.id')
        .where('branch.id IN (:...branchIds)', { branchIds })
        .andWhere('branch.isHeadquarters = false')
        .andWhere('branch.isActive = true')
        .getMany();
      userNonHqBranchIds = nonHqBranches.map((b) => b.id);
    }

    // 3. Extract callsign region digit
    let callSignRegion: string | null = null;
    if (userOperator?.callSign) {
      const match = userOperator.callSign.match(/^[A-Za-z]+(\d)/);
      callSignRegion = match ? match[1] : null;
    }

    return {
      selfOperatorId: userOperator?.id ?? null,
      city: userOperator?.city ?? null,
      district: userOperator?.district ?? null,
      callSignRegion,
      userNonHqBranchIds,
    };
  }

  async getContextCached(userId: string): Promise<RelevanceContext> {
    const cached = this.contextCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const data = await this.getUserRelevanceContext(userId);
    this.contextCache.set(userId, {
      data,
      expiresAt: Date.now() + 5 * 60_000,
    });
    return data;
  }

  /**
   * Attaches relevance scoring to a query builder as `relevance_score`.
   * Callers should ORDER BY 'relevance_score' DESC after calling this.
   * Assumes the query builder already has `operator` and `user` aliases.
   */
  buildRelevanceScore(
    qb: SelectQueryBuilder<any>,
    ctx: RelevanceContext,
  ): void {
    const parts: string[] = [];

    // Self: +999
    if (ctx.selfOperatorId) {
      parts.push(
        `CASE WHEN "operator"."id" = :relSelfOpId THEN 999 ELSE 0 END`,
      );
      qb.setParameter('relSelfOpId', ctx.selfOperatorId);
    }

    // Registered user account: +2
    parts.push(`CASE WHEN "user"."id" IS NOT NULL THEN 2 ELSE 0 END`);

    // Shared non-HQ branches: +8 per shared branch
    if (ctx.userNonHqBranchIds.length > 0) {
      parts.push(
        `COALESCE((` +
          `SELECT COUNT(DISTINCT m_rel."branchId") * 8 ` +
          `FROM "user_branch_memberships" m_rel ` +
          `INNER JOIN "branches" b_rel ON b_rel."id" = m_rel."branchId" ` +
          `WHERE m_rel."userId" = "user"."id" ` +
          `AND m_rel."branchId" IN (:...relBranchIds) ` +
          `AND m_rel."status" = 'approved' ` +
          `AND b_rel."isHeadquarters" = false` +
          `), 0)`,
      );
      qb.setParameter('relBranchIds', ctx.userNonHqBranchIds);
    }

    // Same callsign region digit: +7
    if (ctx.callSignRegion) {
      parts.push(
        `CASE WHEN SUBSTRING("operator"."callSign" FROM '^[A-Za-z]+(\\d)') = :relRegion THEN 7 ELSE 0 END`,
      );
      qb.setParameter('relRegion', ctx.callSignRegion);
    }

    // Same city: +4
    if (ctx.city) {
      parts.push(
        `CASE WHEN "operator"."city" = :relCity THEN 4 ELSE 0 END`,
      );
      qb.setParameter('relCity', ctx.city);
    }

    // Shared nets (90 days): +2 per net, max 5 nets = max +10
    if (ctx.selfOperatorId) {
      parts.push(
        `COALESCE((` +
          `SELECT LEAST(COUNT(DISTINCT a_peer."netId"), 5) * 2 ` +
          `FROM "attendees" a_peer ` +
          `INNER JOIN "attendees" a_self ON a_self."netId" = a_peer."netId" ` +
          `INNER JOIN "nets" n_rel ON n_rel."id" = a_peer."netId" ` +
          `WHERE a_self."operatorId" = :relSelfOpId2 ` +
          `AND a_peer."operatorId" = "operator"."id" ` +
          `AND a_peer."operatorId" != :relSelfOpId2 ` +
          `AND n_rel."endedAt" > :relNinetyDaysAgo` +
          `), 0)`,
      );
      qb.setParameter('relSelfOpId2', ctx.selfOperatorId);
      qb.setParameter(
        'relNinetyDaysAgo',
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      );
    }

    // Same district: +1
    if (ctx.district) {
      parts.push(
        `CASE WHEN "operator"."district" = :relDistrict THEN 1 ELSE 0 END`,
      );
      qb.setParameter('relDistrict', ctx.district);
    }

    const scoreExpr =
      parts.length > 0 ? `(${parts.join(' + ')})` : '0';
    qb.addSelect(scoreExpr, 'relevance_score');
  }

  // ── Query methods ─────────────────────────────────────────────────

  async findWithStats(
    query: OperatorQueryDto,
    userId?: string,
  ): Promise<{
    data: (Operator & { attendedCount: number; managedCount: number })[];
    total: number;
  }> {
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
      const searchTerm = normalizeTurkishSearchTerm(query.search);
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
      const searchTerm = normalizeTurkishSearchTerm(query.search);
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

    // Apply relevance scoring or fall back to default sort
    if (userId) {
      const ctx = await this.getContextCached(userId);
      this.buildRelevanceScore(baseQueryBuilder, ctx);
      baseQueryBuilder
        .orderBy('relevance_score', 'DESC')
        .addOrderBy('operator.callSign', 'ASC');
    } else {
      baseQueryBuilder
        .addSelect(
          'CASE WHEN user.id IS NOT NULL THEN 0 ELSE 1 END',
          'user_priority',
        )
        .orderBy('CASE WHEN user.id IS NOT NULL THEN 0 ELSE 1 END', 'ASC')
        .addOrderBy('operator.callSign', 'ASC');
    }

    const rawAndEntities = await baseQueryBuilder
      .offset((query.pageNumber - 1) * query.pageSize)
      .limit(query.pageSize)
      .getRawAndEntities();

    const data = rawAndEntities.entities.map((entity, idx) => ({
      ...entity,
      attendedCount: parseInt(
        String(rawAndEntities.raw[idx]?.attendedCount ?? '0'),
        10,
      ),
      managedCount: parseInt(
        String(rawAndEntities.raw[idx]?.managedCount ?? '0'),
        10,
      ),
    }));

    return { data, total };
  }

  async findAllWithUser(userId?: string): Promise<Operator[]> {
    const qb = this.operatorRepository
      .createQueryBuilder('operator')
      .leftJoinAndSelect('operator.user', 'user')
      .where('user.id IS NOT NULL');

    if (userId) {
      const ctx = await this.getContextCached(userId);
      this.buildRelevanceScore(qb, ctx);
      qb.orderBy('relevance_score', 'DESC').addOrderBy(
        'operator.callSign',
        'ASC',
      );
    } else {
      qb.orderBy('operator.callSign', 'ASC');
    }

    return qb.getMany();
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
    const callSign = (operatorData.callSign ?? '').trim();
    const existingOperator = await this.operatorRepository.findOne({
      where: { callSign },
      relations: { user: true },
    });

    const trimOptional = (v: string | null | undefined) =>
      (v ?? '').trim() || undefined;
    const trimmed = {
      ...operatorData,
      callSign,
      fullName: trimOptional(operatorData.fullName),
      city: trimOptional(operatorData.city),
      district: trimOptional(operatorData.district),
      country: trimOptional(operatorData.country),
      createdBy,
      updatedBy: [],
    };

    if (!existingOperator) {
      const operator = this.operatorRepository.create(trimmed);
      return this.operatorRepository.save(operator);
    }

    if (existingOperator.user) {
      throw new ForbiddenException('error.operatorAlreadyExists');
    }

    Object.assign(existingOperator, trimmed);
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
    const trimOrNull = (v: string | null | undefined) =>
      (v ?? '').trim() || null;
    const updates: DeepPartial<Operator> = {
      ...operatorData,
      updatedBy: [...(operator.updatedBy || []), updatedBy],
    };
    if (operatorData.callSign !== undefined) {
      updates.callSign = (operatorData.callSign ?? '').trim();
    }
    if (operatorData.fullName !== undefined) {
      updates.fullName = trimOrNull(operatorData.fullName);
    }
    if (operatorData.city !== undefined) {
      updates.city = trimOrNull(operatorData.city);
    }
    if (operatorData.district !== undefined) {
      updates.district = trimOrNull(operatorData.district);
    }
    if (operatorData.country !== undefined) {
      updates.country = trimOrNull(operatorData.country);
    }
    if (operatorData.gridSquare !== undefined) {
      updates.gridSquare = trimOrNull(operatorData.gridSquare);
    }
    if (operatorData.prefix !== undefined) {
      updates.prefix = trimOrNull(operatorData.prefix);
    }
    if (operatorData.suffix !== undefined) {
      updates.suffix = trimOrNull(operatorData.suffix);
    }
    if (operatorData.dmrId !== undefined) {
      const raw = operatorData.dmrId as number | string | null;
      updates.dmrId = raw === null || raw === '' ? null : Number(raw);
    }
    Object.assign(operator, updates);
    return this.operatorRepository.save(operator);
  }

  async import(
    records: Record<string, string>[],
    createdBy: string,
  ): Promise<void> {
    const operators = records
      .filter((record) => (record.callSign ?? '').trim())
      .map((record) => {
        const operator = new Operator();
        operator.callSign = (record.callSign ?? '').trim().toUpperCase();
        operator.prefix = (record.prefix ?? '').trim() || undefined;
        operator.suffix = (record.suffix ?? '').trim() || undefined;
        operator.country = (record.country ?? '').trim()
          ? toTitleCase((record.country ?? '').trim())
          : undefined;
        operator.city = (record.city ?? '').trim()
          ? toTitleCase((record.city ?? '').trim())
          : undefined;
        operator.district = (record.district ?? '').trim()
          ? toTitleCase((record.district ?? '').trim())
          : undefined;
        operator.gridSquare = (record.gridSquare ?? '').trim() || undefined;
        operator.fullName = (record.fullName ?? '').trim()
          ? toTitleCase((record.fullName ?? '').trim())
          : undefined;
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
    priorityBranchId?: string,
    userId?: string,
  ): Promise<OperatorSearchResult[]> {
    const searchTerm = normalizeTurkishSearchTerm(query);

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

    // Add sortBy-specific JOINs and GROUP BY
    if (sortBy === 'managed') {
      qb.leftJoin('operator.nets', 'net')
        .addSelect('COUNT(DISTINCT net.id)', 'managedCount')
        .addSelect('MAX(net.endedAt)', 'lastNetDate')
        .groupBy('operator.id')
        .addGroupBy('user.id');
    } else if (sortBy === 'attended') {
      qb.leftJoin('operator.attendees', 'attendee')
        .addSelect('COUNT(DISTINCT attendee.id)', 'attendedCount')
        .groupBy('operator.id')
        .addGroupBy('user.id');
    }

    // Apply relevance scoring or fall back to legacy sort
    if (userId) {
      const ctx = await this.getContextCached(userId);
      this.buildRelevanceScore(qb, ctx);

      // Primary: relevance, Secondary: sortBy metric, Tertiary: callSign
      qb.orderBy('relevance_score', 'DESC');
      if (sortBy === 'managed') {
        qb.addOrderBy('COUNT(DISTINCT net.id)', 'DESC');
        qb.addOrderBy('MAX(net.endedAt)', 'DESC', 'NULLS LAST');
      } else if (sortBy === 'attended') {
        qb.addOrderBy('COUNT(DISTINCT attendee.id)', 'DESC');
      }
      qb.addOrderBy('operator.callSign', 'ASC');
    } else {
      // Fallback: original sort without relevance
      if (sortBy === 'managed') {
        qb.orderBy('COUNT(DISTINCT net.id)', 'DESC')
          .addOrderBy('MAX(net.endedAt)', 'DESC', 'NULLS LAST')
          .addOrderBy('operator.callSign', 'ASC');
      } else if (sortBy === 'attended') {
        qb.orderBy('COUNT(DISTINCT attendee.id)', 'DESC').addOrderBy(
          'operator.callSign',
          'ASC',
        );
      } else {
        qb.orderBy('operator.callSign', 'ASC');
      }
    }

    const result = await qb.limit(limit).getRawAndEntities();
    const entities = result.entities;

    // Compute isBranchMember flag (kept for frontend display)
    let branchMemberUserIds: Set<string> = new Set();
    if (priorityBranchId) {
      const memberships = await this.membershipRepository.find({
        where: {
          branchId: priorityBranchId,
          status: MembershipStatus.APPROVED,
        },
        select: ['userId'],
      });
      branchMemberUserIds = new Set(memberships.map((m) => m.userId));
    }

    return entities.map((op) => ({
      ...op,
      isBranchMember: op.user?.id
        ? branchMemberUserIds.has(op.user.id)
        : false,
    }));
  }

  async delete(id: string): Promise<void> {
    const operator = await this.operatorRepository.findOne({
      where: { id },
      relations: { user: true, attendees: true },
    });
    if (!operator) {
      throw new NotFoundException(`${id} ile eşleşen bir kayıt bulunamadı`);
    }

    const usedInScheduler = await this.netSchedulerRepository.count({
      where: { operatorId: id },
    });
    if (usedInScheduler > 0) {
      throw new BadRequestException('error.operatorUsedInScheduler');
    }

    if (operator.user) {
      throw new BadRequestException(
        `${operator.callSign} için bir kullanıcı bulunduğu için silinemez`,
      );
    }

    const managedNets = await this.netRepository.count({
      where: { operator: { id } },
    });
    if (managedNets > 0) {
      throw new BadRequestException(
        `${operator.callSign} en az bir çevrim yönettiği için silinemez`,
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
    const _operator = await this.findOne(id);

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
      averageReadability:
        parseFloat(String(signalReadability?.avgReadability ?? 0)) || 0,
      averageSignal: parseFloat(String(signalReadability?.avgSignal ?? 0)) || 0,
    };
  }

  async getRecentNets(
    id: string,
    limit: number = 10,
    offset: number = 0,
    branchId?: string,
  ): Promise<OperatorNetItem[]> {
    const fetchLimit = limit + offset + 50;

    const attendedQb = this.attendeeRepository
      .createQueryBuilder('attendee')
      .leftJoinAndSelect('attendee.net', 'net')
      .where('attendee.operatorId = :id', { id })
      .andWhere('net.endedAt IS NOT NULL')
      .orderBy('net.endedAt', 'DESC')
      .limit(fetchLimit);
    if (branchId) {
      attendedQb.andWhere('net.branchId = :branchId', { branchId });
    }

    const managedQb = this.netRepository
      .createQueryBuilder('net')
      .leftJoin('net.attendees', 'attendee')
      .addSelect('COUNT(attendee.id)', 'attendeeCount')
      .where('net.operatorId = :id', { id })
      .andWhere('net.endedAt IS NOT NULL')
      .groupBy('net.id')
      .orderBy('net.endedAt', 'DESC')
      .limit(fetchLimit);
    if (branchId) {
      managedQb.andWhere('net.branchId = :branchId', { branchId });
    }

    const [attendedNets, managedNets] = await Promise.all([
      attendedQb.getMany(),
      managedQb.getRawAndEntities(),
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
      attendeeCount: parseInt(
        String(managedNets.raw[idx]?.attendeeCount ?? '0'),
        10,
      ),
    }));

    const all = [...attended, ...managed].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const uniqueNets = new Map<string, OperatorNetItem>();
    for (const net of all) {
      if (!uniqueNets.has(net.id)) {
        uniqueNets.set(net.id, net);
      } else {
        const _existing = uniqueNets.get(net.id);
        if (net.role === 'managed') {
          uniqueNets.set(net.id, { ...net, role: 'managed' });
        }
      }
    }

    return Array.from(uniqueNets.values()).slice(offset, offset + limit);
  }

  async getCertificates(operatorId: string): Promise<
    {
      netId: string;
      netName: string;
      netDate: string;
      branchName: string;
      certificateTemplateId: string;
      attendeeId: string;
    }[]
  > {
    const rows = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .innerJoin('attendee.net', 'net')
      .innerJoin('net.branch', 'branch')
      .where('attendee.operatorId = :operatorId', { operatorId })
      .andWhere('net.endedAt IS NOT NULL')
      .andWhere('net.certificateTemplateId IS NOT NULL')
      .select([
        'attendee.id AS "attendeeId"',
        'net.id AS "netId"',
        'net.name AS "netName"',
        'net.endedAt AS "netDate"',
        'branch.name AS "branchName"',
        'net.certificateTemplateId AS "certificateTemplateId"',
      ])
      .orderBy('net.endedAt', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      attendeeId: r.attendeeId,
      netId: r.netId,
      netName: r.netName ?? '',
      netDate: r.netDate ? new Date(r.netDate).toISOString() : '',
      branchName: r.branchName ?? '',
      certificateTemplateId: r.certificateTemplateId ?? '',
    }));
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
