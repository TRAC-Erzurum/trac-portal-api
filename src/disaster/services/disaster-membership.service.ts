import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalRole } from '../../auth/enums/role.enum';
import { UserService } from '../../user/services/user.service';
import { DisasterMembership } from '../entities/disaster-membership.entity';
import { AssignMemberDto } from '../dto/assign-member.dto';
import { UpdateMemberDto } from '../dto/update-member.dto';
import { DisasterRole } from '../enums/disaster-role.enum';
import { DisasterMembershipStatus } from '../enums/membership-status.enum';

export type UserDisasterRole = 'ADMIN' | 'FIELD_OFFICER' | 'USER';

@Injectable()
export class DisasterMembershipService {
  constructor(
    @InjectRepository(DisasterMembership)
    private readonly membershipRepository: Repository<DisasterMembership>,
    private readonly userService: UserService,
  ) {}

  async getUserDisasterRole(
    disasterId: string,
    userId: string,
  ): Promise<UserDisasterRole> {
    const user = await this.userService.findOne(userId).catch(() => null);
    if (user?.globalRole === GlobalRole.SUPER_ADMIN) {
      return 'ADMIN';
    }

    const membership = await this.membershipRepository.findOne({
      where: {
        disasterId,
        userId,
        status: DisasterMembershipStatus.APPROVED,
      },
    });

    if (!membership) {
      return 'USER';
    }

    return membership.role;
  }

  async isDisasterAdmin(disasterId: string, userId: string): Promise<boolean> {
    const membership = await this.membershipRepository.findOne({
      where: {
        disasterId,
        userId,
        status: DisasterMembershipStatus.APPROVED,
        role: DisasterRole.ADMIN,
      },
    });
    return !!membership;
  }

  async listMembers(disasterId: string): Promise<DisasterMembership[]> {
    const memberships = await this.membershipRepository.find({
      where: { disasterId },
      relations: { user: { operator: true } },
      order: { createdAt: 'ASC' },
    });

    for (const membership of memberships) {
      if (membership.user) {
        (membership.user as unknown as { callSign?: string }).callSign =
          membership.user.operator?.callSign;
      }
    }

    return memberships;
  }

  private async countAdmins(disasterId: string): Promise<number> {
    return this.membershipRepository.count({
      where: {
        disasterId,
        role: DisasterRole.ADMIN,
        status: DisasterMembershipStatus.APPROVED,
      },
    });
  }

  async assignMember(
    disasterId: string,
    dto: AssignMemberDto,
    processedBy: string,
    actorEmail: string,
  ): Promise<DisasterMembership> {
    const userExists = await this.userService.exists(dto.userId);
    if (!userExists) {
      throw new NotFoundException('error.notFound');
    }

    const existing = await this.membershipRepository.findOne({
      where: { disasterId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('error.alreadyExists');
    }

    const membership = this.membershipRepository.create({
      disasterId,
      userId: dto.userId,
      role: dto.role,
      status: DisasterMembershipStatus.APPROVED,
      processedBy,
      processedAt: new Date(),
      createdBy: actorEmail,
      updatedBy: [],
    });

    return this.membershipRepository.save(membership);
  }

  async updateMember(
    disasterId: string,
    userId: string,
    dto: UpdateMemberDto,
    actorEmail: string,
  ): Promise<DisasterMembership> {
    const membership = await this.membershipRepository.findOne({
      where: { disasterId, userId },
    });
    if (!membership) {
      throw new NotFoundException('error.notFound');
    }

    if (
      membership.role === DisasterRole.ADMIN &&
      dto.role !== DisasterRole.ADMIN &&
      membership.status === DisasterMembershipStatus.APPROVED
    ) {
      const adminCount = await this.countAdmins(disasterId);
      if (adminCount <= 1) {
        throw new BadRequestException('error.lastDisasterAdminRequired');
      }
    }

    membership.role = dto.role;
    membership.updatedBy = [...(membership.updatedBy || []), actorEmail];
    return this.membershipRepository.save(membership);
  }

  async removeMember(disasterId: string, userId: string): Promise<void> {
    const membership = await this.membershipRepository.findOne({
      where: { disasterId, userId },
    });
    if (!membership) {
      throw new NotFoundException('error.notFound');
    }

    if (
      membership.role === DisasterRole.ADMIN &&
      membership.status === DisasterMembershipStatus.APPROVED
    ) {
      const adminCount = await this.countAdmins(disasterId);
      if (adminCount <= 1) {
        throw new BadRequestException('error.lastDisasterAdminRequired');
      }
    }

    await this.membershipRepository.remove(membership);
  }
}
