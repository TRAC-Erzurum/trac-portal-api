import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OperatorBranchMembership } from '../entities/operator-branch-membership.entity';
import { Branch } from '../entities/branch.entity';
import { User } from '../../user/entities/user.entity';
import { Net } from '../../net/entities/net.entity';
import { BranchRole } from '../enums/branch-role.enum';
import { MembershipStatus } from '../enums/membership-status.enum';
import { GlobalRole, type EffectiveRole } from '../../auth/enums/role.enum';
import {
  ActivityEvent,
  ACTIVITY_EVENT,
} from '../../activity/events/activity.events';
import {
  ActivityType,
  EntityType,
} from '../../activity/enums/activity-type.enum';
import { UserService } from '../../user/services/user.service';
import { OperatorService } from '../../operator/services/operator.service';
import { Operator } from '../../operator/entities/operator.entity';
import { NetScheduler } from '../../net-scheduler/entities/net-scheduler.entity';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(OperatorBranchMembership)
    private readonly membershipRepository: Repository<OperatorBranchMembership>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    @InjectRepository(Operator)
    private readonly operatorRepository: Repository<Operator>,
    @InjectRepository(NetScheduler)
    private readonly netSchedulerRepository: Repository<NetScheduler>,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly operatorService: OperatorService,
  ) {}

  private async syncEffectiveRoleForOperator(
    operatorId: string,
  ): Promise<void> {
    const op = await this.operatorRepository.findOne({
      where: { id: operatorId },
      relations: ['user'],
    });
    if (op?.user?.id) {
      await this.userService.syncRoleColumn(op.user.id);
    }
  }

  private async requireOperatorIdForUser(userId: string): Promise<string> {
    const operator = await this.operatorService.findByUserId(userId);
    if (!operator) {
      throw new BadRequestException('error.userMustHaveOperator');
    }
    return operator.id;
  }

  async createMembership(
    operatorId: string,
    branchId: string,
    role: BranchRole,
    status: MembershipStatus,
    createdBy: string,
  ): Promise<OperatorBranchMembership> {
    const existingMembership = await this.membershipRepository.findOne({
      where: { operatorId, branchId },
    });

    if (existingMembership) {
      return existingMembership;
    }

    const membership = new OperatorBranchMembership();
    membership.operatorId = operatorId;
    membership.branchId = branchId;
    membership.role = role;
    membership.status = status;
    membership.createdBy = createdBy;
    membership.updatedBy = [];

    const saved = await this.membershipRepository.save(membership);
    await this.syncEffectiveRoleForOperator(operatorId);
    return saved;
  }

  async addMemberDirectly(
    branchId: string,
    operatorId: string,
    role: BranchRole,
    addedBy: string,
    actorCallSign: string,
  ): Promise<OperatorBranchMembership> {
    const existingMembership = await this.membershipRepository.findOne({
      where: { operatorId, branchId },
      relations: ['operator', 'operator.user', 'branch'],
    });

    if (existingMembership) {
      if (existingMembership.status === MembershipStatus.APPROVED) {
        throw new ConflictException('error.alreadyMember');
      }
      existingMembership.status = MembershipStatus.APPROVED;
      existingMembership.role = role;
      existingMembership.updatedBy = [...existingMembership.updatedBy, addedBy];
      const saved = await this.membershipRepository.save(existingMembership);
      await this.syncEffectiveRoleForOperator(operatorId);

      this.eventEmitter.emit('membership.approved', {
        membership: saved,
        actorCallSign,
      });

      return saved;
    }

    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException('error.branchNotFound');
    }

    const operator = await this.operatorRepository.findOne({
      where: { id: operatorId },
      relations: ['user'],
    });
    if (!operator) {
      throw new NotFoundException('error.operatorNotFound');
    }

    const membership = new OperatorBranchMembership();
    membership.operatorId = operatorId;
    membership.branchId = branchId;
    membership.role = role;
    membership.status = MembershipStatus.APPROVED;
    membership.createdBy = addedBy;
    membership.updatedBy = [];

    const saved = await this.membershipRepository.save(membership);

    saved.operator = operator;
    saved.branch = branch;

    this.eventEmitter.emit('membership.approved', {
      membership: saved,
      actorCallSign,
    });

    await this.syncEffectiveRoleForOperator(operatorId);

    return saved;
  }

  async join(
    userId: string,
    branchId: string,
  ): Promise<OperatorBranchMembership> {
    const operatorId = await this.requireOperatorIdForUser(userId);

    const existingMembership = await this.membershipRepository.findOne({
      where: { operatorId, branchId },
    });

    if (existingMembership) {
      if (existingMembership.status === MembershipStatus.APPROVED) {
        throw new ConflictException('error.alreadyMember');
      }
      if (existingMembership.status === MembershipStatus.PENDING) {
        throw new ConflictException('error.membershipRequestPending');
      }
    }

    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException('error.branchNotFound');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['operator'],
    });
    if (!user) {
      throw new NotFoundException('error.userNotFound');
    }

    const membership = new OperatorBranchMembership();
    membership.operatorId = operatorId;
    membership.branchId = branchId;
    membership.role = BranchRole.MEMBER;
    const superAdminJoinsHq =
      user.globalRole === GlobalRole.SUPER_ADMIN && branch.isHeadquarters;
    membership.status = superAdminJoinsHq
      ? MembershipStatus.APPROVED
      : MembershipStatus.PENDING;
    membership.createdBy = userId;
    membership.updatedBy = [];

    try {
      const saved = await this.membershipRepository.save(membership);

      if (superAdminJoinsHq) {
        const targetCallSign = user.operator?.callSign ?? null;
        this.eventEmitter.emit(
          ACTIVITY_EVENT,
          new ActivityEvent(
            ActivityType.MEMBERSHIP_APPROVED,
            EntityType.MEMBERSHIP,
            saved.id,
            userId,
            targetCallSign,
            targetCallSign,
            { branchId: branch.id, branchName: branch.name },
          ),
        );
      }

      await this.syncEffectiveRoleForOperator(operatorId);

      return saved;
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('error.membershipAlreadyExists');
      }
      console.error('Membership join error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async approve(
    membershipId: string,
    approvedBy: string,
    actorCallSign: string,
    role: BranchRole = BranchRole.MEMBER,
    branchId?: string,
  ): Promise<OperatorBranchMembership> {
    const membership = await this.membershipRepository.findOne({
      where: { id: membershipId },
      relations: ['operator', 'operator.user', 'branch'],
    });

    if (!membership) {
      throw new NotFoundException('error.membershipNotFound');
    }

    if (branchId && membership.branchId !== branchId) {
      throw new NotFoundException('error.membershipNotFound');
    }

    if (membership.status === MembershipStatus.APPROVED) {
      throw new BadRequestException('error.membershipAlreadyApproved');
    }

    const existingApprovedCount = await this.membershipRepository.count({
      where: {
        operatorId: membership.operatorId,
        status: MembershipStatus.APPROVED,
      },
    });

    const isFirstApproval = existingApprovedCount === 0;

    membership.status = MembershipStatus.APPROVED;
    membership.role = role;
    membership.processedBy = approvedBy;
    membership.processedAt = new Date();
    membership.rejectionReason = null;
    membership.updatedBy = [...(membership.updatedBy || []), approvedBy];

    try {
      const saved = await this.membershipRepository.save(membership);

      if (isFirstApproval) {
        const hqBranch = await this.branchRepository.findOne({
          where: { isHeadquarters: true },
        });

        if (hqBranch) {
          const existingHqMembership = await this.membershipRepository.findOne({
            where: {
              operatorId: membership.operatorId,
              branchId: hqBranch.id,
            },
          });

          if (!existingHqMembership) {
            const hqMembership = new OperatorBranchMembership();
            hqMembership.operatorId = membership.operatorId;
            hqMembership.branchId = hqBranch.id;
            hqMembership.role = BranchRole.MEMBER;
            hqMembership.status = MembershipStatus.APPROVED;
            hqMembership.createdBy = approvedBy;
            hqMembership.updatedBy = [];

            await this.membershipRepository.save(hqMembership);
          }
        }
      }

      await this.syncEffectiveRoleForOperator(membership.operatorId);

      const targetUserId = membership.operator?.user?.id ?? null;
      const targetCallSign = membership.operator?.callSign ?? null;
      this.eventEmitter.emit(
        ACTIVITY_EVENT,
        new ActivityEvent(
          ActivityType.MEMBERSHIP_APPROVED,
          EntityType.MEMBERSHIP,
          saved.id,
          targetUserId,
          actorCallSign,
          targetCallSign,
          {
            branchId: membership.branchId,
            branchName: membership.branch.name,
            operatorId: membership.operatorId,
          },
        ),
      );

      return saved;
    } catch (error) {
      console.error('Membership approve error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async reject(
    membershipId: string,
    rejectedBy: string,
    actorCallSign: string,
    rejectionReason?: string,
    branchId?: string,
  ): Promise<OperatorBranchMembership> {
    const membership = await this.membershipRepository.findOne({
      where: { id: membershipId },
      relations: ['operator', 'operator.user', 'branch'],
    });

    if (!membership) {
      throw new NotFoundException('error.membershipNotFound');
    }

    if (branchId && membership.branchId !== branchId) {
      throw new NotFoundException('error.membershipNotFound');
    }

    if (membership.status === MembershipStatus.REJECTED) {
      throw new BadRequestException('error.membershipAlreadyRejected');
    }

    membership.status = MembershipStatus.REJECTED;
    membership.processedBy = rejectedBy;
    membership.processedAt = new Date();
    membership.rejectionReason = rejectionReason ?? null;
    membership.updatedBy = [...(membership.updatedBy || []), rejectedBy];

    try {
      const saved = await this.membershipRepository.save(membership);
      const targetUserId = membership.operator?.user?.id ?? null;
      const targetCallSign = membership.operator?.callSign ?? null;
      this.eventEmitter.emit(
        ACTIVITY_EVENT,
        new ActivityEvent(
          ActivityType.MEMBERSHIP_REJECTED,
          EntityType.MEMBERSHIP,
          saved.id,
          targetUserId,
          actorCallSign,
          targetCallSign,
          {
            branchId: membership.branchId,
            branchName: membership.branch.name,
            operatorId: membership.operatorId,
          },
        ),
      );

      return saved;
    } catch (error) {
      console.error('Membership reject error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async remove(
    operatorId: string,
    branchId: string,
    removedBy: string,
    actorCallSign: string,
    actorRole: EffectiveRole,
  ): Promise<void> {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException('error.branchNotFound');
    }

    if (branch.isHeadquarters) {
      throw new ForbiddenException('error.cannotRemoveFromHeadquarters');
    }

    const operator = await this.operatorRepository.findOne({
      where: { id: operatorId },
      relations: ['user'],
    });
    if (!operator) {
      throw new NotFoundException('error.operatorNotFound');
    }

    const linkedUser = operator.user;
    if (linkedUser) {
      if (
        linkedUser.globalRole === GlobalRole.SUPER_ADMIN &&
        actorRole !== GlobalRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException('error.cannotRemoveSuperAdmin');
      }
    }

    const hasActiveOrPendingNet = await this.netRepository
      .createQueryBuilder('net')
      .where('net.operatorId = :operatorId', { operatorId })
      .andWhere('net.endedAt IS NULL')
      .getCount();
    if (hasActiveOrPendingNet > 0) {
      throw new BadRequestException('error.userHasActiveNet');
    }

    const membership = await this.membershipRepository.findOne({
      where: { operatorId, branchId },
      relations: ['operator', 'operator.user', 'branch'],
    });

    if (!membership) {
      throw new NotFoundException('error.membershipNotFound');
    }

    const usedInScheduler = await this.netSchedulerRepository.count({
      where: {
        operatorId,
        branchId,
      },
    });
    if (usedInScheduler > 0) {
      throw new BadRequestException('error.operatorUsedInScheduler');
    }

    const targetCallSign = membership.operator?.callSign ?? null;
    const targetUserId = membership.operator?.user?.id ?? null;

    try {
      await this.membershipRepository.remove(membership);
      await this.syncEffectiveRoleForOperator(operatorId);

      this.eventEmitter.emit(
        ACTIVITY_EVENT,
        new ActivityEvent(
          ActivityType.MEMBERSHIP_REMOVED,
          EntityType.MEMBERSHIP,
          null,
          targetUserId,
          actorCallSign,
          targetCallSign,
          { branchId, branchName: branch.name, operatorId },
        ),
      );
    } catch (error) {
      console.error('Membership remove error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async getMembersByBranch(
    branchId: string,
    pageNumber?: number,
    pageSize?: number,
    search?: string,
    role?: string,
    userId?: string,
  ): Promise<{ data: OperatorBranchMembership[]; total: number }> {
    const queryBuilder = this.membershipRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .leftJoinAndSelect('membership.branch', 'branch')
      .where('membership.branchId = :branchId', { branchId })
      .andWhere('membership.status = :status', {
        status: MembershipStatus.APPROVED,
      });

    if (search) {
      queryBuilder.andWhere(
        '(' +
          'LOWER(COALESCE(user.fullName, \'\')) LIKE LOWER(:search) OR ' +
          'LOWER(COALESCE(user.email, \'\')) LIKE LOWER(:search) OR ' +
          'LOWER(operator.callSign) LIKE LOWER(:search) OR ' +
          'LOWER(COALESCE(operator.fullName, \'\')) LIKE LOWER(:search)' +
          ')',
        { search: `%${search}%` },
      );
    }

    if (role) {
      queryBuilder.andWhere('membership.role = :role', { role });
    }

    const total = await queryBuilder.getCount();

    if (userId) {
      const ctx = await this.operatorService.getContextCached(userId);
      this.operatorService.buildRelevanceScore(queryBuilder, ctx);
      queryBuilder
        .orderBy('relevance_score', 'DESC')
        .addOrderBy('operator.callSign', 'ASC');
    } else {
      queryBuilder.orderBy('membership.createdAt', 'ASC');
    }

    if (pageNumber && pageSize) {
      queryBuilder.skip((pageNumber - 1) * pageSize).take(pageSize);
    }

    const data = await queryBuilder.getMany();

    return { data, total };
  }

  async getUserBranches(userId: string): Promise<OperatorBranchMembership[]> {
    const operator = await this.operatorService.findByUserId(userId);
    if (!operator) {
      return [];
    }
    return this.membershipRepository.find({
      where: {
        operatorId: operator.id,
        status: MembershipStatus.APPROVED,
      },
      relations: ['branch', 'branch.callSigns'],
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async findMembership(
    userId: string,
    branchId: string,
  ): Promise<OperatorBranchMembership | null> {
    const operator = await this.operatorService.findByUserId(userId);
    if (!operator) {
      return null;
    }
    return this.membershipRepository.findOne({
      where: { operatorId: operator.id, branchId },
      relations: ['operator', 'operator.user', 'branch'],
    });
  }

  async hasApprovedPresidentInAnyBranch(userId: string): Promise<boolean> {
    const operator = await this.operatorService.findByUserId(userId);
    if (!operator) {
      return false;
    }
    const n = await this.membershipRepository.count({
      where: {
        operatorId: operator.id,
        status: MembershipStatus.APPROVED,
        role: BranchRole.PRESIDENT,
      },
    });
    return n > 0;
  }

  async hasApprovedBranchLeadershipInAnyBranch(userId: string): Promise<boolean> {
    const operator = await this.operatorService.findByUserId(userId);
    if (!operator) {
      return false;
    }
    const n = await this.membershipRepository.count({
      where: {
        operatorId: operator.id,
        status: MembershipStatus.APPROVED,
        role: In([BranchRole.ADMIN, BranchRole.PRESIDENT]),
      },
    });
    return n > 0;
  }

  async hasApprovedHeadquartersLeadership(userId: string): Promise<boolean> {
    const operator = await this.operatorService.findByUserId(userId);
    if (!operator) {
      return false;
    }
    const n = await this.membershipRepository
      .createQueryBuilder('m')
      .innerJoin('m.branch', 'b')
      .where('m.operatorId = :operatorId', { operatorId: operator.id })
      .andWhere('m.status = :status', { status: MembershipStatus.APPROVED })
      .andWhere('m.role IN (:...roles)', {
        roles: [BranchRole.ADMIN, BranchRole.PRESIDENT],
      })
      .andWhere('b.isHeadquarters = true')
      .getCount();
    return n > 0;
  }

  async canActAsBranchLeaderOnBranch(
    userId: string,
    branchId: string,
  ): Promise<boolean> {
    const operator = await this.operatorService.findByUserId(userId);
    if (!operator) {
      return false;
    }
    const local = await this.membershipRepository.findOne({
      where: {
        operatorId: operator.id,
        branchId,
        status: MembershipStatus.APPROVED,
        role: In([BranchRole.ADMIN, BranchRole.PRESIDENT]),
      },
    });
    if (local) {
      return true;
    }
    return this.hasApprovedHeadquartersLeadership(userId);
  }

  async getUserMemberships(userId: string): Promise<OperatorBranchMembership[]> {
    const operator = await this.operatorService.findByUserId(userId);
    if (!operator) {
      return [];
    }
    return this.membershipRepository.find({
      where: { operatorId: operator.id },
      relations: ['branch', 'branch.callSigns'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateRole(
    membershipId: string,
    role: BranchRole,
    updatedBy: string,
    actorCallSign: string,
    branchId?: string,
  ): Promise<OperatorBranchMembership> {
    const membership = await this.membershipRepository.findOne({
      where: { id: membershipId },
      relations: ['operator', 'operator.user', 'branch'],
    });

    if (!membership) {
      throw new NotFoundException('error.membershipNotFound');
    }

    if (branchId && membership.branchId !== branchId) {
      throw new NotFoundException('error.membershipNotFound');
    }

    if (membership.status !== MembershipStatus.APPROVED) {
      throw new BadRequestException('error.membershipNotApproved');
    }

    const linkedUser = membership.operator?.user;
    if (linkedUser?.globalRole === GlobalRole.SUPER_ADMIN) {
      throw new ForbiddenException('error.cannotChangeSuperAdminRole');
    }

    if (
      (membership.role === BranchRole.ADMIN ||
        membership.role === BranchRole.PRESIDENT) &&
      role !== BranchRole.ADMIN &&
      role !== BranchRole.PRESIDENT
    ) {
      const adminCount = await this.membershipRepository.count({
        where: [
          {
            branchId: membership.branchId,
            status: MembershipStatus.APPROVED,
            role: BranchRole.ADMIN,
          },
          {
            branchId: membership.branchId,
            status: MembershipStatus.APPROVED,
            role: BranchRole.PRESIDENT,
          },
        ],
      });
      if (adminCount <= 1) {
        throw new BadRequestException('error.lastAdminCannotBeDemoted');
      }
    }

    membership.role = role;
    membership.updatedBy = [...(membership.updatedBy || []), updatedBy];

    try {
      const saved = await this.membershipRepository.save(membership);
      const targetCallSign = membership.operator?.callSign ?? null;
      const targetUserId = membership.operator?.user?.id ?? null;
      this.eventEmitter.emit(
        ACTIVITY_EVENT,
        new ActivityEvent(
          ActivityType.MEMBERSHIP_ROLE_UPDATED,
          EntityType.MEMBERSHIP,
          saved.id,
          targetUserId,
          actorCallSign,
          targetCallSign,
          {
            branchId: membership.branchId,
            branchName: membership.branch.name,
            newRole: role,
            operatorId: membership.operatorId,
          },
        ),
      );
      await this.syncEffectiveRoleForOperator(membership.operatorId);
      return saved;
    } catch (error) {
      console.error('Membership updateRole error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async getPendingMembershipsByBranch(
    branchId: string,
  ): Promise<OperatorBranchMembership[]> {
    return this.membershipRepository.find({
      where: { branchId, status: MembershipStatus.PENDING },
      relations: ['operator', 'operator.user', 'branch'],
      order: { createdAt: 'ASC' },
    });
  }

  private async getAdminBranchIdsForUser(userId: string): Promise<string[]> {
    const operator = await this.operatorService.findByUserId(userId);
    if (!operator) {
      return [];
    }
    const adminMemberships = await this.membershipRepository.find({
      where: [
        {
          operatorId: operator.id,
          status: MembershipStatus.APPROVED,
          role: BranchRole.ADMIN,
        },
        {
          operatorId: operator.id,
          status: MembershipStatus.APPROVED,
          role: BranchRole.PRESIDENT,
        },
      ],
      select: ['branchId'],
    });
    return adminMemberships.map((m) => m.branchId);
  }

  async getPendingRequestsCountForAdmin(userId: string): Promise<number> {
    const effectiveRole = await this.userService.getEffectiveRole(userId);

    if (effectiveRole === GlobalRole.SUPER_ADMIN) {
      return this.membershipRepository.count({
        where: { status: MembershipStatus.PENDING },
      });
    }

    const branchIds = await this.getAdminBranchIdsForUser(userId);
    let count = 0;
    for (const branchId of branchIds) {
      count += await this.membershipRepository.count({
        where: { branchId, status: MembershipStatus.PENDING },
      });
    }
    return count;
  }

  async getPendingRequestsForAdmin(userId: string): Promise<{
    branches: Array<{
      branchId: string;
      branchName: string;
      pendingMemberships: OperatorBranchMembership[];
    }>;
  }> {
    const effectiveRole = await this.userService.getEffectiveRole(userId);

    let branches: Array<{ branchId: string; name: string }> = [];

    if (effectiveRole === GlobalRole.SUPER_ADMIN) {
      const allBranches = await this.branchRepository.find({
        where: { isActive: true },
        select: ['id', 'name'],
      });
      branches = allBranches.map((b) => ({ branchId: b.id, name: b.name }));
    } else {
      const operator = await this.operatorService.findByUserId(userId);
      if (!operator) {
        return { branches: [] };
      }
      const adminMemberships = await this.membershipRepository.find({
        where: [
          {
            operatorId: operator.id,
            status: MembershipStatus.APPROVED,
            role: BranchRole.ADMIN,
          },
          {
            operatorId: operator.id,
            status: MembershipStatus.APPROVED,
            role: BranchRole.PRESIDENT,
          },
        ],
        relations: ['branch'],
      });
      branches = adminMemberships.map((m) => ({
        branchId: m.branchId,
        name: m.branch.name,
      }));
    }

    const result: Array<{
      branchId: string;
      branchName: string;
      pendingMemberships: OperatorBranchMembership[];
    }> = [];

    for (const branch of branches) {
      const pending = await this.getPendingMembershipsByBranch(branch.branchId);
      if (pending.length > 0 || effectiveRole === GlobalRole.SUPER_ADMIN) {
        result.push({
          branchId: branch.branchId,
          branchName: branch.name,
          pendingMemberships: pending,
        });
      }
    }

    return { branches: result };
  }

  /** Onaylı üyelik sayısı (operatör bazlı; kayıt koşulu için). */
  async countApprovedMembershipsForOperator(operatorId: string): Promise<number> {
    return this.membershipRepository.count({
      where: { operatorId, status: MembershipStatus.APPROVED },
    });
  }

  async getMembershipsForOperator(
    operatorId: string,
  ): Promise<OperatorBranchMembership[]> {
    return this.membershipRepository.find({
      where: { operatorId },
      relations: ['branch', 'branch.callSigns'],
      order: { createdAt: 'DESC' },
    });
  }
}
