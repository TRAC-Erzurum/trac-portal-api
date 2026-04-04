import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotAcceptableException,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, ILike, In } from 'typeorm';
import { User } from '../entities/user.entity';
import {
  GlobalRole,
  BranchRole,
  type EffectiveRole,
  effectiveRoleRank,
  isLeadershipOrSuperEffective,
} from '../../auth/enums/role.enum';
import { Operator } from '../../operator/entities/operator.entity';
import { OperatorService } from '../../operator/services/operator.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { normalizeTurkishText } from '../../shared/utils/turkish-search.util';
import { extractPlainCallSign } from '../../shared/utils/call-sign.util';
import * as crypto from 'crypto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthUser } from '../../auth/types/auth.types';
import { BranchService } from '../../branch/services/branch.service';
import { MembershipService } from '../../branch/services/membership.service';
import { OperatorBranchMembership } from '../../branch/entities/operator-branch-membership.entity';
import { MembershipStatus } from '../../branch/enums/membership-status.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(OperatorBranchMembership)
    private readonly membershipRepository: Repository<OperatorBranchMembership>,
    private readonly operatorService: OperatorService,
    private readonly branchService: BranchService,
    @Inject(forwardRef(() => MembershipService))
    private readonly membershipService: MembershipService,
  ) { }

  async findByEmail(email: string): Promise<User> {
    return this.userRepository.findOne({
      where: { email },
      relations: { operator: true },
    });
  }

  async create(user: DeepPartial<User>, createdBy: string): Promise<User> {
    const userCount = await this.userRepository.count();

    if (userCount === 0) {
      user.globalRole = GlobalRole.SUPER_ADMIN;
    } else {
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

    const saved = await this.userRepository.save(user as User);
    await this.syncRoleColumn(saved.id);

    return this.findByEmail(user.email);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  private async isApprovedBranchLeader(userId: string): Promise<boolean> {
    return this.membershipService.hasApprovedBranchLeadershipInAnyBranch(userId);
  }

  private async isBranchLeaderInBranch(
    userId: string,
    branchId: string,
  ): Promise<boolean> {
    const operator = await this.operatorService.findByUserId(userId);
    if (!operator) {
      return false;
    }
    const m = await this.membershipRepository.findOne({
      where: {
        operatorId: operator.id,
        branchId,
        status: MembershipStatus.APPROVED,
        role: In([BranchRole.ADMIN, BranchRole.PRESIDENT]),
      },
    });
    return !!m;
  }

  /** `users.role` önbelleğini üyelikler + globalRole ile günceller. */
  async syncRoleColumn(userId: string): Promise<void> {
    const eff = await this.getEffectiveRole(userId);
    await this.userRepository.update({ id: userId }, { role: eff });
  }

  async updateUserRole(
    userId: string,
    role: BranchRole,
    requester: AuthUser,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('error.notFound');
    }

    if (user.globalRole === GlobalRole.SUPER_ADMIN) {
      throw new ForbiddenException('error.superAdminRoleCannotBeChanged');
    }

    const requesterElevated = isLeadershipOrSuperEffective(requester.role);

    if (!requesterElevated) {
      const ok = await this.isApprovedBranchLeader(requester.id);
      if (!ok) {
        throw new ForbiddenException('error.noPermission');
      }
      if (role === BranchRole.ADMIN || role === BranchRole.PRESIDENT) {
        throw new ForbiddenException('error.noPermission');
      }
      const targetEff = await this.getEffectiveRole(userId);
      if (
        targetEff === BranchRole.ADMIN ||
        targetEff === BranchRole.PRESIDENT
      ) {
        throw new ForbiddenException('error.noPermission');
      }
    }

    const targetOperator = await this.operatorService.findByUserId(userId);
    if (!targetOperator) {
      throw new BadRequestException('error.invalidData');
    }

    const memberships = await this.membershipRepository.find({
      where: {
        operatorId: targetOperator.id,
        status: MembershipStatus.APPROVED,
      },
    });

    if (memberships.length === 0) {
      throw new BadRequestException('error.invalidData');
    }

    const isSuper = requester.role === GlobalRole.SUPER_ADMIN;

    for (const m of memberships) {
      const can =
        isSuper ||
        (await this.membershipService.canActAsBranchLeaderOnBranch(
          requester.id,
          m.branchId,
        ));
      if (can) {
        m.role = role;
        m.updatedBy = [...(m.updatedBy || []), requester.email];
        await this.membershipRepository.save(m);
      }
    }

    await this.syncRoleColumn(userId);
    user.updatedBy = [...(user.updatedBy || []), requester.email];
    await this.userRepository.save(user);

    return this.findOne(userId);
  }

  async findOne(id: string, requester?: AuthUser): Promise<User> {
    const user = await this.userRepository.findOneOrFail({
      where: { id },
      relations: { operator: { branchMemberships: { branch: true } } },
    });

    if (requester && !(await this.canAccessSensitiveData(requester, id))) {
      delete user.addresses;
      delete user.phoneNumbers;
      delete user.emergencyContacts;
      delete user.profession;
      delete user.birthDate;
      delete user.idNumber;
    }

    return user;
  }

  async canAccessSensitiveData(
    requester: AuthUser,
    targetUserId: string,
  ): Promise<boolean> {
    if (
      requester.role === GlobalRole.SUPER_ADMIN ||
      requester.globalRole === GlobalRole.SUPER_ADMIN ||
      requester.id === targetUserId
    ) {
      return true;
    }

    const requesterOperator = await this.operatorService.findByUserId(
      requester.id,
    );
    const targetOperator = await this.operatorService.findByUserId(
      targetUserId,
    );
    if (!requesterOperator || !targetOperator) {
      return false;
    }

    const requesterAdminMemberships = await this.membershipRepository.find({
      where: [
        {
          operatorId: requesterOperator.id,
          role: BranchRole.ADMIN,
          status: MembershipStatus.APPROVED,
        },
        {
          operatorId: requesterOperator.id,
          role: BranchRole.PRESIDENT,
          status: MembershipStatus.APPROVED,
        },
      ],
    });

    if (requesterAdminMemberships.length === 0) {
      return false;
    }

    const branchIds = requesterAdminMemberships.map((m) => m.branchId);

    const isMemberInSameBranch = await this.membershipRepository.findOne({
      where: {
        operatorId: targetOperator.id,
        branchId: In(branchIds),
        status: MembershipStatus.APPROVED,
      },
    });

    if (isMemberInSameBranch) {
      return true;
    }

    const targetMemberships = await this.membershipRepository.find({
      where: {
        operatorId: targetOperator.id,
        status: MembershipStatus.APPROVED,
      },
      select: ['branchId'],
    });
    for (const tm of targetMemberships) {
      if (
        await this.membershipService.canActAsBranchLeaderOnBranch(
          requester.id,
          tm.branchId,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  async findOperatorByUserId(userId: string): Promise<Operator | null> {
    return this.operatorService.findByUserId(userId);
  }

  async getEffectiveRole(userId: string): Promise<EffectiveRole> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) return GlobalRole.GUEST;
    if (user.globalRole === GlobalRole.SUPER_ADMIN) {
      return GlobalRole.SUPER_ADMIN;
    }
    const operator = await this.operatorService.findByUserId(userId);
    if (!operator) {
      return GlobalRole.GUEST;
    }
    const memberships = await this.membershipRepository.find({
      where: { operatorId: operator.id, status: MembershipStatus.APPROVED },
    });
    if (memberships.length === 0) return GlobalRole.GUEST;
    if (memberships.some((m) => m.role === BranchRole.PRESIDENT)) {
      return BranchRole.PRESIDENT;
    }
    if (memberships.some((m) => m.role === BranchRole.ADMIN)) {
      return BranchRole.ADMIN;
    }
    if (memberships.some((m) => m.role === BranchRole.MEMBER)) {
      return BranchRole.MEMBER;
    }
    if (memberships.some((m) => m.role === BranchRole.VOLUNTEER)) {
      return BranchRole.VOLUNTEER;
    }
    return GlobalRole.GUEST;
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

    if (dto.addresses !== undefined) {
      fieldsToUpdate.addresses = dto.addresses;
    }

    if (dto.phoneNumbers !== undefined) {
      fieldsToUpdate.phoneNumbers = dto.phoneNumbers;
    }

    if (dto.emergencyContacts !== undefined) {
      fieldsToUpdate.emergencyContacts = dto.emergencyContacts;
    }

    if (dto.profession !== undefined) {
      fieldsToUpdate.profession = dto.profession;
    }

    if (dto.birthDate !== undefined) {
      fieldsToUpdate.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }

    if (dto.idNumber !== undefined) {
      fieldsToUpdate.idNumber = dto.idNumber;
    }

    if (dto.expertiseAreas !== undefined) {
      fieldsToUpdate.expertiseAreas = dto.expertiseAreas;
    }

    if (dto.trainings !== undefined) {
      fieldsToUpdate.trainings = dto.trainings;
    }

    user.updatedBy = [...(user.updatedBy || []), updatedBy];
    Object.assign(user, fieldsToUpdate);
    await this.userRepository.save(user);

    return this.findOne(userId);
  }

  async validate(identifier: string, password: string): Promise<User> {
    const normalizedIdentifier = normalizeTurkishText(identifier);
    let user = await this.userRepository.findOne({
      where: [
        { email: ILike(normalizedIdentifier) },
        { operator: { callSign: ILike(normalizedIdentifier) } },
      ],
      relations: { operator: true },
    });

    if (!user && normalizedIdentifier.includes('/')) {
      const plainCallSign = extractPlainCallSign(normalizedIdentifier);
      if (plainCallSign) {
        user = await this.userRepository.findOne({
          where: { operator: { callSign: ILike(plainCallSign) } },
          relations: { operator: true },
        });
      }
    }

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

    if (adminUser.role !== GlobalRole.SUPER_ADMIN) {
      if (
        effectiveRoleRank(targetEffectiveRole) >=
        effectiveRoleRank(adminUser.role)
      ) {
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
    return isLeadershipOrSuperEffective(role);
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const role = await this.getEffectiveRole(userId);
    return role === GlobalRole.SUPER_ADMIN;
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
    const branch = await this.branchService.findOne(branchId);

    const effectiveRole = await this.getEffectiveRole(userId);
    if (effectiveRole === GlobalRole.SUPER_ADMIN) {
      return;
    }

    if (
      branch.isActive &&
      (await this.membershipService.hasApprovedHeadquartersLeadership(userId))
    ) {
      return;
    }

    const membership = await this.membershipService.findMembership(
      userId,
      branchId,
    );

    if (!membership || membership.status !== MembershipStatus.APPROVED) {
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
