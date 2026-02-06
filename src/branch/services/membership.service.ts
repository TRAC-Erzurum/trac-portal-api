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
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserBranchMembership } from '../entities/user-branch-membership.entity';
import { Branch } from '../entities/branch.entity';
import { User } from '../../user/entities/user.entity';
import { Net } from '../../net/entities/net.entity';
import { BranchRole } from '../enums/branch-role.enum';
import { MembershipStatus } from '../enums/membership-status.enum';
import { Role } from '../../auth/enums/role.enum';
import { GlobalRole } from '../../auth/enums/role.enum';
import { ActivityEvent, ACTIVITY_EVENT } from '../../activity/events/activity.events';
import { ActivityType, EntityType } from '../../activity/enums/activity-type.enum';
import { UserService } from '../../user/services/user.service';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(UserBranchMembership)
    private readonly membershipRepository: Repository<UserBranchMembership>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  async createMembership(
    userId: string,
    branchId: string,
    role: BranchRole,
    status: MembershipStatus,
    createdBy: string,
  ): Promise<UserBranchMembership> {
    const existingMembership = await this.membershipRepository.findOne({
      where: { userId, branchId },
    });

    if (existingMembership) {
      return existingMembership;
    }

    const membership = new UserBranchMembership();
    membership.userId = userId;
    membership.branchId = branchId;
    membership.role = role;
    membership.status = status;
    membership.createdBy = createdBy;
    membership.updatedBy = [];

    return this.membershipRepository.save(membership);
  }

  async addMemberDirectly(
    branchId: string,
    userId: string,
    role: BranchRole,
    addedBy: string,
    actorCallSign: string,
  ): Promise<UserBranchMembership> {
    const existingMembership = await this.membershipRepository.findOne({
      where: { userId, branchId },
      relations: ['user', 'branch'],
    });

    if (existingMembership) {
      if (existingMembership.status === MembershipStatus.APPROVED) {
        throw new ConflictException('error.alreadyMember');
      }
      existingMembership.status = MembershipStatus.APPROVED;
      existingMembership.role = role;
      existingMembership.updatedBy = [...existingMembership.updatedBy, addedBy];
      const saved = await this.membershipRepository.save(existingMembership);

      this.eventEmitter.emit('membership.approved', {
        membership: saved,
        actorCallSign,
      });

      return saved;
    }

    const branch = await this.branchRepository.findOne({ where: { id: branchId } });
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

    const membership = new UserBranchMembership();
    membership.userId = userId;
    membership.branchId = branchId;
    membership.role = role;
    membership.status = MembershipStatus.APPROVED;
    membership.createdBy = addedBy;
    membership.updatedBy = [];

    const saved = await this.membershipRepository.save(membership);
    
    saved.user = user;
    saved.branch = branch;

    this.eventEmitter.emit('membership.approved', {
      membership: saved,
      actorCallSign,
    });

    return saved;
  }

  async join(userId: string, branchId: string): Promise<UserBranchMembership> {
    const existingMembership = await this.membershipRepository.findOne({
      where: { userId, branchId },
    });

    if (existingMembership) {
      if (existingMembership.status === MembershipStatus.APPROVED) {
        throw new ConflictException('error.alreadyMember');
      }
      if (existingMembership.status === MembershipStatus.PENDING) {
        throw new ConflictException('error.membershipRequestPending');
      }
    }

    const branch = await this.branchRepository.findOne({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException('error.branchNotFound');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('error.userNotFound');
    }

    const membership = new UserBranchMembership();
    membership.userId = userId;
    membership.branchId = branchId;
    membership.role = BranchRole.MEMBER;
    membership.status = MembershipStatus.PENDING;
    membership.createdBy = userId;
    membership.updatedBy = [];

    try {
      const saved = await this.membershipRepository.save(membership);
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
  ): Promise<UserBranchMembership> {
    const membership = await this.membershipRepository.findOne({
      where: { id: membershipId },
      relations: ['user', 'branch'],
    });

    if (!membership) {
      throw new NotFoundException('error.membershipNotFound');
    }

    if (membership.status === MembershipStatus.APPROVED) {
      throw new BadRequestException('error.membershipAlreadyApproved');
    }

    const existingApprovedCount = await this.membershipRepository.count({
      where: {
        userId: membership.userId,
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
              userId: membership.userId,
              branchId: hqBranch.id,
            },
          });

          if (!existingHqMembership) {
            const hqMembership = new UserBranchMembership();
            hqMembership.userId = membership.userId;
            hqMembership.branchId = hqBranch.id;
            hqMembership.role = BranchRole.MEMBER;
            hqMembership.status = MembershipStatus.APPROVED;
            hqMembership.createdBy = approvedBy;
            hqMembership.updatedBy = [];

            await this.membershipRepository.save(hqMembership);
          }
        }
      }

      this.eventEmitter.emit(
        ACTIVITY_EVENT,
        new ActivityEvent(
          ActivityType.MEMBERSHIP_APPROVED,
          EntityType.MEMBERSHIP,
          saved.id,
          membership.userId,
          actorCallSign,
          null,
          { branchId: membership.branchId, branchName: membership.branch.name },
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
  ): Promise<UserBranchMembership> {
    const membership = await this.membershipRepository.findOne({
      where: { id: membershipId },
      relations: ['user', 'branch'],
    });

    if (!membership) {
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

      this.eventEmitter.emit(
        ACTIVITY_EVENT,
        new ActivityEvent(
          ActivityType.MEMBERSHIP_REJECTED,
          EntityType.MEMBERSHIP,
          saved.id,
          membership.userId,
          actorCallSign,
          null,
          { branchId: membership.branchId, branchName: membership.branch.name },
        ),
      );

      return saved;
    } catch (error) {
      console.error('Membership reject error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async remove(
    userId: string,
    branchId: string,
    removedBy: string,
    actorCallSign: string,
  ): Promise<void> {
    const branch = await this.branchRepository.findOne({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException('error.branchNotFound');
    }

    if (branch.isHeadquarters) {
      throw new ForbiddenException('error.cannotRemoveFromHeadquarters');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('error.userNotFound');
    }

    if (user.globalRole === GlobalRole.SUPER_ADMIN) {
      throw new ForbiddenException('error.cannotRemoveSuperAdmin');
    }

    const hasActiveOrPendingNet = await this.netRepository
      .createQueryBuilder('net')
      .innerJoin('net.operator', 'op')
      .where('op.userId = :userId', { userId })
      .andWhere('net.endedAt IS NULL')
      .getCount();
    if (hasActiveOrPendingNet > 0) {
      throw new BadRequestException('error.userHasActiveNet');
    }

    const membership = await this.membershipRepository.findOne({
      where: { userId, branchId },
      relations: ['user', 'branch'],
    });

    if (!membership) {
      throw new NotFoundException('error.membershipNotFound');
    }

    try {
      await this.membershipRepository.remove(membership);

      this.eventEmitter.emit(
        ACTIVITY_EVENT,
        new ActivityEvent(
          ActivityType.MEMBERSHIP_REMOVED,
          EntityType.MEMBERSHIP,
          null,
          userId,
          actorCallSign,
          null,
          { branchId, branchName: branch.name },
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
  ): Promise<{ data: UserBranchMembership[]; total: number }> {
    const queryBuilder = this.membershipRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.user', 'user')
      .leftJoinAndSelect('user.operator', 'operator')
      .leftJoinAndSelect('membership.branch', 'branch')
      .where('membership.branchId = :branchId', { branchId })
      .andWhere('membership.status = :status', { status: MembershipStatus.APPROVED });

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(user.fullName) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search) OR LOWER(operator.callSign) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    if (role) {
      queryBuilder.andWhere('membership.role = :role', { role });
    }

    queryBuilder.orderBy('membership.createdAt', 'ASC');

    const total = await queryBuilder.getCount();

    if (pageNumber && pageSize) {
      queryBuilder.skip((pageNumber - 1) * pageSize).take(pageSize);
    }

    const data = await queryBuilder.getMany();

    return { data, total };
  }

  async getUserBranches(userId: string): Promise<UserBranchMembership[]> {
    return this.membershipRepository.find({
      where: {
        userId,
        status: MembershipStatus.APPROVED,
      },
      relations: ['branch', 'branch.callSigns'],
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async findMembership(userId: string, branchId: string): Promise<UserBranchMembership | null> {
    return this.membershipRepository.findOne({
      where: { userId, branchId },
      relations: ['user', 'branch'],
    });
  }

  async getUserMemberships(userId: string): Promise<UserBranchMembership[]> {
    return this.membershipRepository.find({
      where: { userId },
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
  ): Promise<UserBranchMembership> {
    const membership = await this.membershipRepository.findOne({
      where: { id: membershipId },
      relations: ['user', 'branch'],
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

    const user = await this.userRepository.findOne({
      where: { id: membership.userId },
    });
    if (!user) {
      throw new NotFoundException('error.userNotFound');
    }
    if (user.globalRole === GlobalRole.SUPER_ADMIN) {
      throw new ForbiddenException('error.cannotChangeSuperAdminRole');
    }

    if ((membership.role === BranchRole.ADMIN || membership.role === BranchRole.PRESIDENT) && 
        role !== BranchRole.ADMIN && role !== BranchRole.PRESIDENT) {
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
      this.eventEmitter.emit(
        ACTIVITY_EVENT,
        new ActivityEvent(
          ActivityType.MEMBERSHIP_ROLE_UPDATED,
          EntityType.MEMBERSHIP,
          saved.id,
          membership.userId,
          actorCallSign,
          null,
          { branchId: membership.branchId, branchName: membership.branch.name, newRole: role },
        ),
      );
      return saved;
    } catch (error) {
      console.error('Membership updateRole error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async getPendingMembershipsByBranch(branchId: string): Promise<UserBranchMembership[]> {
    return this.membershipRepository.find({
      where: { branchId, status: MembershipStatus.PENDING },
      relations: ['user', 'user.operator', 'branch'],
      order: { createdAt: 'ASC' },
    });
  }

  async getPendingRequestsCountForAdmin(userId: string): Promise<number> {
    const effectiveRole = await this.userService.getEffectiveRole(userId);
    
    if (effectiveRole === Role.SUPER_ADMIN) {
      return this.membershipRepository.count({
        where: { status: MembershipStatus.PENDING },
      });
    }
    
    const adminMemberships = await this.membershipRepository.find({
      where: [
        { userId, status: MembershipStatus.APPROVED, role: BranchRole.ADMIN },
        { userId, status: MembershipStatus.APPROVED, role: BranchRole.PRESIDENT },
      ],
    });
    let count = 0;
    for (const admin of adminMemberships) {
      count += await this.membershipRepository.count({
        where: { branchId: admin.branchId, status: MembershipStatus.PENDING },
      });
    }
    return count;
  }

  async getPendingRequestsForAdmin(userId: string): Promise<{
    branches: Array<{
      branchId: string;
      branchName: string;
      pendingMemberships: UserBranchMembership[];
    }>;
  }> {
    const effectiveRole = await this.userService.getEffectiveRole(userId);
    
    let branches: Array<{ branchId: string; name: string }> = [];
    
    if (effectiveRole === Role.SUPER_ADMIN) {
      const allBranches = await this.branchRepository.find({
        where: { isActive: true },
        select: ['id', 'name'],
      });
      branches = allBranches.map(b => ({ branchId: b.id, name: b.name }));
    } else {
      const adminMemberships = await this.membershipRepository.find({
        where: [
          { userId, status: MembershipStatus.APPROVED, role: BranchRole.ADMIN },
          { userId, status: MembershipStatus.APPROVED, role: BranchRole.PRESIDENT },
        ],
        relations: ['branch'],
      });
      branches = adminMemberships.map(m => ({ branchId: m.branchId, name: m.branch.name }));
    }
    
    const result: Array<{
      branchId: string;
      branchName: string;
      pendingMemberships: UserBranchMembership[];
    }> = [];
    
    for (const branch of branches) {
      const pending = await this.getPendingMembershipsByBranch(branch.branchId);
      if (pending.length > 0 || effectiveRole === Role.SUPER_ADMIN) {
        result.push({
          branchId: branch.branchId,
          branchName: branch.name,
          pendingMemberships: pending,
        });
      }
    }
    
    return { branches: result };
  }
}
