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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserBranchMembership } from '../entities/user-branch-membership.entity';
import { Branch } from '../entities/branch.entity';
import { User } from '../../user/entities/user.entity';
import { BranchRole } from '../enums/branch-role.enum';
import { MembershipStatus } from '../enums/membership-status.enum';
import { Role } from '../../auth/enums/role.enum';
import { ActivityEvent, ACTIVITY_EVENT } from '../../activity/events/activity.events';
import { ActivityType, EntityType } from '../../activity/enums/activity-type.enum';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(UserBranchMembership)
    private readonly membershipRepository: Repository<UserBranchMembership>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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

    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('error.cannotRemoveSuperAdmin');
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

  async getMembersByBranch(branchId: string): Promise<UserBranchMembership[]> {
    return this.membershipRepository.find({
      where: {
        branchId,
        status: MembershipStatus.APPROVED,
      },
      relations: ['user', 'user.operator', 'branch'],
      order: {
        createdAt: 'ASC',
      },
    });
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
}
