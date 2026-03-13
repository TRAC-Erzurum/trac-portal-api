import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { BranchCallSign } from '../entities/branch-call-sign.entity';
import { UserBranchMembership } from '../entities/user-branch-membership.entity';
import { User } from '../../user/entities/user.entity';
import { Operator } from '../../operator/entities/operator.entity';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { DeleteBranchDto } from '../dto/delete-branch.dto';
import { Role } from '../../auth/enums/role.enum';
import { BranchRole } from '../enums/branch-role.enum';
import { MembershipStatus } from '../enums/membership-status.enum';
import { normalizeTurkishSearchTerm } from '../../shared/utils/turkish-search.util';
import {
  isValidCallSignFormat,
  normalizePlainCallSign,
} from '../../shared/utils/call-sign.util';

@Injectable()
export class BranchService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(BranchCallSign)
    private readonly callSignRepository: Repository<BranchCallSign>,
    @InjectRepository(UserBranchMembership)
    private readonly membershipRepository: Repository<UserBranchMembership>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Operator)
    private readonly operatorRepository: Repository<Operator>,
  ) {}

  async create(
    dto: CreateBranchDto,
    createdBy: string,
    _actorCallSign: string,
  ): Promise<Branch> {
    // Check if branch name already exists
    const existingBranch = await this.branchRepository.findOne({
      where: { name: dto.name },
    });
    if (existingBranch) {
      throw new ConflictException('error.branchNameExists');
    }

    for (const raw of dto.callSigns) {
      const trimmed = (raw ?? '').trim();
      if (!isValidCallSignFormat(trimmed, { allowSlashes: false })) {
        throw new BadRequestException('error.callSignPlainOnly');
      }
    }

    const normalizedCallSigns = dto.callSigns.map((raw) =>
      normalizePlainCallSign((raw ?? '').trim()),
    );

    // Check if any callSign already exists in another branch
    const existingCallSigns = await this.callSignRepository
      .createQueryBuilder('cs')
      .where('cs.callSign IN (:...callSigns)', { callSigns: normalizedCallSigns })
      .getMany();
    if (existingCallSigns.length > 0) {
      throw new ConflictException('error.callSignExists');
    }
    // Check that none of the call signs are used by an operator
    const usedByOperator = await this.operatorRepository
      .createQueryBuilder('op')
      .where('op.callSign IN (:...callSigns)', { callSigns: normalizedCallSigns })
      .getCount();
    if (usedByOperator > 0) {
      throw new ConflictException('error.callSignUsedByOperator');
    }

    // Create branch
    const branch = new Branch();
    branch.name = dto.name;
    branch.type = dto.type;
    branch.address = dto.address;
    branch.phone = dto.phone;
    branch.email = dto.email;
    branch.isHeadquarters = false;
    branch.isActive = true;
    branch.createdBy = createdBy;
    branch.updatedBy = [];

    // Create callSigns - first one is default
    const callSigns = normalizedCallSigns.map((callSignValue, index) => {
      const callSign = new BranchCallSign();
      callSign.callSign = callSignValue;
      callSign.isDefault = index === 0;
      callSign.branch = branch;
      callSign.createdBy = createdBy;
      callSign.updatedBy = [];
      return callSign;
    });

    branch.callSigns = callSigns;

    try {
      const saved = await this.branchRepository.save(branch);

      const superAdmins = await this.userRepository.find({
        where: { role: Role.SUPER_ADMIN },
      });

      for (const admin of superAdmins) {
        const membership = new UserBranchMembership();
        membership.userId = admin.id;
        membership.branchId = saved.id;
        membership.role = BranchRole.ADMIN;
        membership.status = MembershipStatus.APPROVED;
        membership.createdBy = createdBy;
        membership.updatedBy = [];
        await this.membershipRepository.save(membership);
      }

      return this.findOne(saved.id);
    } catch (error) {
      if (error.code === '23505') {
        if (error.constraint?.includes('name')) {
          throw new ConflictException('error.branchNameExists');
        }
        if (error.constraint?.includes('callSign')) {
          throw new ConflictException('error.callSignExists');
        }
        throw new ConflictException('error.alreadyExists');
      }
      console.error('Branch save error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async findAll(
    options: {
      includeInactive?: boolean;
      search?: string;
      pageNumber?: number;
      pageSize?: number;
    } = {},
  ): Promise<{ data: Branch[]; total: number }> {
    const qb = this.branchRepository
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.callSigns', 'callSigns')
      .orderBy('branch.name', 'ASC');

    if (!options.includeInactive) {
      qb.where('branch.isActive = :isActive', { isActive: true });
    }

    if (options.search) {
      const searchTerm = normalizeTurkishSearchTerm(options.search);
      qb.andWhere(
        '(LOWER(branch.name) LIKE :search OR EXISTS (SELECT 1 FROM branch_call_signs bcs WHERE bcs."branchId" = branch.id AND LOWER(bcs."callSign") LIKE :search))',
        { search: searchTerm },
      );
    }

    const total = await qb.getCount();

    if (options.pageNumber && options.pageSize) {
      qb.skip((options.pageNumber - 1) * options.pageSize).take(
        options.pageSize,
      );
    }

    const data = await qb.getMany();

    return { data, total };
  }

  async findOne(id: string): Promise<Branch> {
    const branch = await this.branchRepository
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.callSigns', 'callSigns')
      .where('branch.id = :id', { id })
      .getOne();

    if (!branch) {
      throw new NotFoundException('error.branchNotFound');
    }

    return branch;
  }

  async findHeadquarters(): Promise<Branch | null> {
    return this.branchRepository.findOne({
      where: { isHeadquarters: true, isActive: true },
    });
  }

  async update(
    id: string,
    dto: UpdateBranchDto,
    updatedBy: string,
  ): Promise<Branch> {
    const branch = await this.branchRepository.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException('error.branchNotFound');
    }

    // For headquarters: only allow contact info updates
    if (branch.isHeadquarters) {
      // Name cannot be changed for headquarters
      if (dto.name && dto.name !== branch.name) {
        throw new ForbiddenException('error.cannotEditHeadquarters');
      }

      // Only update contact info for headquarters
      if (dto.address !== undefined) {
        branch.address = dto.address;
      }
      if (dto.phone !== undefined) {
        branch.phone = dto.phone;
      }
      if (dto.email !== undefined) {
        branch.email = dto.email;
      }

      // Update audit fields
      branch.updatedBy = [...(branch.updatedBy || []), updatedBy];

      try {
        const saved = await this.branchRepository.save(branch);
        return this.findOne(saved.id);
      } catch (error) {
        console.error('Branch update error:', error);
        throw new InternalServerErrorException('error.internal');
      }
    }

    // For regular branches: proceed with full update logic
    // Check name uniqueness if name is being updated
    if (dto.name && dto.name !== branch.name) {
      const existingBranch = await this.branchRepository.findOne({
        where: { name: dto.name },
      });
      if (existingBranch) {
        throw new ConflictException('error.branchNameExists');
      }
      branch.name = dto.name;
    }

    // Update other fields
    if (dto.type !== undefined) {
      branch.type = dto.type;
    }
    if (dto.address !== undefined) {
      branch.address = dto.address;
    }
    if (dto.phone !== undefined) {
      branch.phone = dto.phone;
    }
    if (dto.email !== undefined) {
      branch.email = dto.email;
    }
    if (dto.city !== undefined) {
      branch.city = dto.city;
    }

    // Handle callSign updates if provided
    if (dto.callSigns !== undefined) {
      if (dto.callSigns.length === 0) {
        throw new BadRequestException('error.atLeastOneCallSignRequired');
      }

      for (const item of dto.callSigns) {
        const trimmed = (item.callSign ?? '').trim();
        if (!isValidCallSignFormat(trimmed, { allowSlashes: false })) {
          throw new BadRequestException('error.callSignPlainOnly');
        }
      }

      const callSignValues = dto.callSigns.map((cs) =>
        normalizePlainCallSign((cs.callSign ?? '').trim()),
      );
      if (new Set(callSignValues).size !== callSignValues.length) {
        throw new ConflictException('error.duplicateCallSigns');
      }

      // Check conflicts with other branches
      const conflicts = await this.callSignRepository
        .createQueryBuilder('cs')
        .where('cs."callSign" IN (:...values)', { values: callSignValues })
        .andWhere('cs."branchId" != :branchId', { branchId: id })
        .getCount();

      if (conflicts > 0) {
        throw new ConflictException('error.callSignExists');
      }

      // Check that none of the call signs are used by an operator
      const usedByOperator = await this.operatorRepository
        .createQueryBuilder('op')
        .where('op.callSign IN (:...values)', { values: callSignValues })
        .getCount();
      if (usedByOperator > 0) {
        throw new ConflictException('error.callSignUsedByOperator');
      }

      // Delete all existing and recreate
      await this.callSignRepository.delete({ branchId: id });

      const hasDefault = dto.callSigns.some((cs) => cs.isDefault);
      for (let i = 0; i < dto.callSigns.length; i++) {
        const cs = new BranchCallSign();
        cs.branchId = id;
        cs.callSign = callSignValues[i];
        cs.isDefault = hasDefault ? dto.callSigns[i].isDefault : i === 0;
        cs.createdBy = updatedBy;
        await this.callSignRepository.save(cs);
      }
    }

    branch.updatedBy = [...(branch.updatedBy || []), updatedBy];

    try {
      const saved = await this.branchRepository.save(branch);
      return this.findOne(saved.id);
    } catch (error) {
      if (error.code === '23505') {
        if (error.constraint?.includes('name')) {
          throw new ConflictException('error.branchNameExists');
        }
      }
      console.error('Branch update error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async deactivate(
    id: string,
    updatedBy: string,
    _actorCallSign: string,
  ): Promise<Branch> {
    const branch = await this.findOne(id);

    // Prevent deactivating headquarters
    if (branch.isHeadquarters) {
      throw new ForbiddenException('error.cannotDeactivateHeadquarters');
    }

    branch.isActive = false;
    branch.updatedBy = [...(branch.updatedBy || []), updatedBy];

    try {
      const saved = await this.branchRepository.save(branch);
      return saved;
    } catch (error) {
      console.error('Branch deactivate error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async activate(
    id: string,
    updatedBy: string,
    _actorCallSign: string,
  ): Promise<Branch> {
    const branch = await this.findOne(id);

    branch.isActive = true;
    branch.updatedBy = [...(branch.updatedBy || []), updatedBy];

    try {
      const saved = await this.branchRepository.save(branch);
      return saved;
    } catch (error) {
      console.error('Branch activate error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async findInactive(): Promise<Branch[]> {
    return this.branchRepository
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.callSigns', 'callSigns')
      .where('branch.isActive = :isActive', { isActive: false })
      .orderBy('branch.name', 'ASC')
      .getMany();
  }

  async delete(id: string, dto: DeleteBranchDto): Promise<void> {
    const branch = await this.findOne(id);

    if (branch.isHeadquarters) {
      throw new ForbiddenException('error.cannotDeleteHeadquarters');
    }

    if (branch.name.trim() !== dto.branchName.trim()) {
      throw new BadRequestException('error.branchNameMismatch');
    }

    const manager = this.branchRepository.manager;
    await manager.transaction(async (tx) => {
      const { Net } = await import('../../net/entities/net.entity');
      const { Attendee } = await import('../../net/entities/attendee.entity');
      const { NetCommunicationChannel } =
        await import('../../net/entities/net-communication-channel.entity');

      const netRepo = tx.getRepository(Net);
      const attendeeRepo = tx.getRepository(Attendee);
      const netChannelRepo = tx.getRepository(NetCommunicationChannel);

      const nets = await netRepo.find({
        where: { branchId: id },
        select: ['id'],
      });
      const netIds = nets.map((n) => n.id);

      for (const netId of netIds) {
        await attendeeRepo.delete({ net: { id: netId } });
        await netChannelRepo.delete({ netId });
      }
      if (netIds.length > 0) {
        await netRepo.delete({ branchId: id });
      }

      await tx.getRepository(UserBranchMembership).delete({ branchId: id });
      await tx.getRepository(BranchCallSign).delete({ branchId: id });
      await tx.getRepository(Branch).delete(id);
    });
  }

  async getBranchNets(
    branchId: string,
    opts: {
      search?: string;
      status?: 'active' | 'pending' | 'completed' | 'cancelled';
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<
    | any[]
    | { data: any[]; total: number; limit: number; offset: number }
  > {
    const { search, status, limit, offset } = opts;
    const usePagination = limit !== undefined || offset !== undefined;
    const limitNum = Math.min(limit ?? 50, 100);
    const offsetNum = offset ?? 0;

    // Import Net repository dynamically to avoid circular dependency
    const { Net } = await import('../../net/entities/net.entity');
    const netRepository = this.branchRepository.manager.getRepository(Net);

    const qb = netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .leftJoinAndSelect('net.branchCallSign', 'branchCallSign')
      .leftJoinAndSelect('net.communicationChannels', 'communicationChannels')
      .leftJoinAndSelect(
        'communicationChannels.communicationChannel',
        'channelDetails',
      )
      .leftJoin('net.attendees', 'attendee')
      .addSelect('COUNT(DISTINCT attendee.id)', 'attendeeCount')
      .where('net.branchId = :branchId', { branchId })
      .groupBy('net.id')
      .addGroupBy('operator.id')
      .addGroupBy('user.id')
      .addGroupBy('branchCallSign.id')
      .addGroupBy('communicationChannels.id')
      .addGroupBy('channelDetails.id')
      .orderBy(
        `CASE 
          WHEN net.startedAt IS NOT NULL AND net.endedAt IS NULL THEN 0 
          WHEN net.startedAt IS NULL AND net.endedAt IS NULL THEN 1 
          WHEN net.startedAt IS NOT NULL AND net.endedAt IS NOT NULL THEN 2 
          ELSE 3 
        END`,
        'ASC',
      )
      .addOrderBy('net.createdAt', 'DESC');

    if (search?.trim()) {
      const searchTerm = normalizeTurkishSearchTerm(search);
      qb.andWhere(
        '(LOWER(net.name) LIKE :search OR LOWER(operator.callSign) LIKE :search)',
        { search: searchTerm },
      );
    }

    if (status) {
      if (status === 'active') {
        qb.andWhere('net.startedAt IS NOT NULL AND net.endedAt IS NULL');
      } else if (status === 'pending') {
        qb.andWhere('net.startedAt IS NULL AND net.endedAt IS NULL');
      } else if (status === 'completed') {
        qb.andWhere('net.startedAt IS NOT NULL AND net.endedAt IS NOT NULL');
      } else if (status === 'cancelled') {
        qb.andWhere('net.startedAt IS NULL AND net.endedAt IS NOT NULL');
      }
    }

    // Count without groupBy (TypeORM getCount() doesn't work correctly with groupBy)
    const countQb = netRepository
      .createQueryBuilder('net')
      .leftJoin('net.operator', 'operator')
      .where('net.branchId = :branchId', { branchId });
    if (search?.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      countQb.andWhere(
        '(LOWER(net.name) LIKE :search OR LOWER(operator.callSign) LIKE :search)',
        { search: searchTerm },
      );
    }
    if (status) {
      if (status === 'active') {
        countQb.andWhere('net.startedAt IS NOT NULL AND net.endedAt IS NULL');
      } else if (status === 'pending') {
        countQb.andWhere('net.startedAt IS NULL AND net.endedAt IS NULL');
      } else if (status === 'completed') {
        countQb.andWhere('net.startedAt IS NOT NULL AND net.endedAt IS NOT NULL');
      } else if (status === 'cancelled') {
        countQb.andWhere('net.startedAt IS NULL AND net.endedAt IS NOT NULL');
      }
    }
    const total = await countQb.getCount();

    if (usePagination) {
      qb.limit(limitNum).offset(offsetNum);
    }

    const result = await qb.getRawAndEntities();
    const data = result.entities.map((net, index) => ({
      ...net,
      attendeeCount: Number(result.raw[index]?.attendeeCount || 0),
    }));

    if (usePagination) {
      return { data, total, limit: limitNum, offset: offsetNum };
    }
    return data;
  }
}
