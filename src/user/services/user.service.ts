import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotAcceptableException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, ILike } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role, GlobalRole } from '../../auth/enums/role.enum';
import { Operator } from '../../operator/entities/operator.entity';
import { OperatorService } from '../../operator/services/operator.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import * as crypto from 'crypto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthUser } from '../../auth/types/auth.types';
import { BranchService } from '../../branch/services/branch.service';
import { UserBranchMembership } from '../../branch/entities/user-branch-membership.entity';
import { MembershipStatus } from '../../branch/enums/membership-status.enum';
import { BranchRole } from '../../branch/enums/branch-role.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserBranchMembership)
    private readonly membershipRepository: Repository<UserBranchMembership>,
    private readonly operatorService: OperatorService,
    private readonly branchService: BranchService,
  ) {}

  async findByEmail(email: string): Promise<User> {
    return this.userRepository.findOne({
      where: { email },
      relations: { operator: true },
    });
  }

  async create(user: DeepPartial<User>, createdBy: string): Promise<User> {
    const userCount = await this.userRepository.count();

    if (userCount === 0) {
      user.role = Role.SUPER_ADMIN;
      user.globalRole = GlobalRole.SUPER_ADMIN;
    } else {
      user.role = Role.GUEST;
      user.globalRole = GlobalRole.GUEST;
    }

    user.createdBy = createdBy;
    user.updatedBy = [];

    if (user.provider === 'local') {
      user.password = crypto
        .createHash('sha256')
        .update(`${user.password}${user.salt}`)
        .digest('hex');
    }

    await this.userRepository.save(user);

    return this.findByEmail(user.email);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async updateUserRole(
    userId: string,
    role: Role,
    updatedBy: string,
  ): Promise<User> {
    if (role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('error.superAdminRoleCannotBeAssigned');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('error.superAdminRoleCannotBeChanged');
    }

    user.role = role;
    user.updatedBy = [...(user.updatedBy || []), updatedBy];
    return this.userRepository.save(user);
  }

  async findOne(id: string): Promise<User> {
    return this.userRepository.findOneOrFail({
      where: { id },
      relations: { operator: true },
    });
  }

  async getEffectiveRole(userId: string): Promise<Role> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) return Role.GUEST;
    if (user.globalRole === GlobalRole.SUPER_ADMIN) return Role.SUPER_ADMIN;
    const memberships = await this.membershipRepository.find({
      where: { userId, status: MembershipStatus.APPROVED },
    });
    if (memberships.length === 0) return Role.GUEST;
    const hasAdmin = memberships.some(
      (m) => m.role === BranchRole.ADMIN || m.role === BranchRole.PRESIDENT,
    );
    const hasMember = memberships.some((m) => m.role === BranchRole.MEMBER);
    const hasVolunteer = memberships.some(
      (m) => m.role === BranchRole.VOLUNTEER,
    );
    if (hasAdmin) return Role.ADMIN;
    if (hasMember) return Role.MEMBER;
    if (hasVolunteer) return Role.VOLUNTEER;
    return Role.GUEST;
  }

  async exists(id: string): Promise<boolean> {
    return this.userRepository.exists({ where: { id } });
  }

  async createOperator(
    userId: string,
    operatorData: DeepPartial<Operator>,
    createdBy: string,
  ): Promise<User> {
    const user = await this.findOne(userId);

    if (user.operator) {
      throw new NotAcceptableException('User already has an operator');
    }

    const operator = await this.operatorService.create(operatorData, createdBy);

    user.operator = operator;
    user.updatedBy = [...(user.updatedBy || []), createdBy];
    await this.userRepository.save(user);

    return user;
  }

  async getOperatorOfUser(userId: string): Promise<Operator> {
    const user = await this.findOne(userId);

    if (!user.operator) {
      throw new NotFoundException('User does not have an operator');
    }

    return user.operator;
  }

  async updateOperator(
    userId: string,
    operatorData: DeepPartial<Operator>,
    updatedBy: string,
  ): Promise<User> {
    const user = await this.findOne(userId);

    if (!user.operator) {
      throw new NotFoundException('User does not have an operator');
    }

    const updatedOperator = await this.operatorService.update(
      user.operator.id,
      operatorData,
      updatedBy,
    );

    user.operator = updatedOperator;
    user.updatedBy = [...(user.updatedBy || []), updatedBy];
    await this.userRepository.save(user);

    return user;
  }

  async updateUser(
    userId: string,
    dto: UpdateUserDto,
    updatedBy: string,
  ): Promise<User> {
    const user = await this.findOne(userId);
    const fieldsToUpdate: Partial<User> = {};

    if (dto.picture !== undefined) {
      fieldsToUpdate.picture = dto.picture;
    }

    if (dto.fullName) {
      fieldsToUpdate.fullName = dto.fullName;
    }

    user.updatedBy = [...(user.updatedBy || []), updatedBy];
    Object.assign(user, fieldsToUpdate);
    await this.userRepository.save(user);

    return this.findOne(userId);
  }

  async validate(identifier: string, password: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: [
        { email: ILike(identifier) },
        { operator: { callSign: ILike(identifier) } },
      ],
    });

    if (!user) {
      Logger.error(`User not found for identifier: ${identifier}`);
      throw new UnauthorizedException('error.invalidCredentials');
    }

    if (!user.password) {
      Logger.error(`User ${identifier} has no password`);
      throw new UnauthorizedException('error.invalidCredentials');
    }

    const hashedPassword = crypto
      .createHash('sha256')
      .update(`${password}${user.salt}`)
      .digest('hex');

    if (hashedPassword !== user.password) {
      Logger.error(`Invalid password for identifier: ${identifier}`);
      throw new UnauthorizedException('error.invalidCredentials');
    }

    return user;
  }

  async setPassword(
    userId: string,
    dto: SetPasswordDto,
    updatedBy: string,
  ): Promise<void> {
    const user = await this.findOne(userId);

    if (user.password) {
      throw new BadRequestException('error.userAlreadyHasPassword');
    }

    const salt = crypto.randomBytes(16).toString('hex');

    const password = crypto
      .createHash('sha256')
      .update(`${dto.newPassword}${salt}`)
      .digest('hex');

    user.salt = salt;
    user.password = password;
    user.updatedBy = [...(user.updatedBy || []), updatedBy];
    await this.userRepository.save(user);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    updatedBy: string,
  ): Promise<void> {
    const user = await this.findOne(userId);

    const hashedCurrentPassword = crypto
      .createHash('sha256')
      .update(`${dto.currentPassword}${user.salt}`)
      .digest('hex');

    if (hashedCurrentPassword !== user.password) {
      throw new BadRequestException('error.invalidCredentials');
    }

    const salt = crypto.randomBytes(16).toString('hex');

    const password = crypto
      .createHash('sha256')
      .update(`${dto.newPassword}${salt}`)
      .digest('hex');

    user.salt = salt;
    user.password = password;
    user.isTemporaryPassword = false;
    user.updatedBy = [...(user.updatedBy || []), updatedBy];
    await this.userRepository.save(user);
  }

  async adminResetPassword(
    targetUserId: string,
    newPassword: string,
    adminUser: AuthUser,
  ): Promise<void> {
    const targetEffectiveRole = await this.getEffectiveRole(targetUserId);

    const roleHierarchy = {
      [Role.SUPER_ADMIN]: 5,
      [Role.ADMIN]: 4,
      [Role.MEMBER]: 3,
      [Role.VOLUNTEER]: 2,
      [Role.GUEST]: 1,
    };

    if (adminUser.role !== Role.SUPER_ADMIN) {
      if (roleHierarchy[targetEffectiveRole] >= roleHierarchy[adminUser.role]) {
        throw new ForbiddenException('error.cannotResetHigherRolePassword');
      }
    }

    const targetUser = await this.findOne(targetUserId);

    const salt = crypto.randomBytes(16).toString('hex');

    const hashedPassword = crypto
      .createHash('sha256')
      .update(`${newPassword}${salt}`)
      .digest('hex');

    targetUser.salt = salt;
    targetUser.password = hashedPassword;
    targetUser.isTemporaryPassword = true;
    targetUser.updatedBy = [...(targetUser.updatedBy || []), adminUser.email];

    await this.userRepository.save(targetUser);
  }

  async isAdmin(userId: string): Promise<boolean> {
    const role = await this.getEffectiveRole(userId);
    return role === Role.ADMIN || role === Role.SUPER_ADMIN;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const role = await this.getEffectiveRole(userId);
    return role === Role.SUPER_ADMIN;
  }

  async forceSetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.findOne(userId);

    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = crypto
      .createHash('sha256')
      .update(`${newPassword}${salt}`)
      .digest('hex');

    user.salt = salt;
    user.password = hashedPassword;
    user.isTemporaryPassword = true;

    await this.userRepository.save(user);
  }

  async clearTemporaryPassword(userId: string): Promise<void> {
    const user = await this.findOne(userId);
    user.isTemporaryPassword = false;
    await this.userRepository.save(user);
  }

  async validateBranchMembership(
    userId: string,
    branchId: string,
  ): Promise<void> {
    await this.branchService.findOne(branchId);

    const effectiveRole = await this.getEffectiveRole(userId);
    if (effectiveRole === Role.SUPER_ADMIN) {
      return;
    }

    const membership = await this.membershipRepository.findOne({
      where: {
        userId,
        branchId,
        status: MembershipStatus.APPROVED,
      },
    });

    if (!membership) {
      throw new ForbiddenException('error.notBranchMember');
    }
  }

  async updateCurrentBranch(userId: string, branchId: string): Promise<void> {
    await this.validateBranchMembership(userId, branchId);

    const user = await this.findOne(userId);
    user.currentBranchId = branchId;
    await this.userRepository.save(user);
  }
}
