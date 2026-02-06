import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthUser, JwtPayload } from '../types/auth.types';
import { UserService } from 'src/user/services/user.service';
import { GoogleProfile } from '../types/auth.types';
import { RegisterDto } from '../dto/register.dto';
import { OperatorService } from '../../operator/services/operator.service';
import { BranchService } from '../../branch/services/branch.service';
import { MembershipService } from '../../branch/services/membership.service';
import { BranchRole } from 'src/branch/enums/branch-role.enum';
import { MembershipStatus } from 'src/branch/enums/membership-status.enum';
import { Role } from '../enums/role.enum';
import {
  PasswordResetRequest,
  PasswordResetStatus,
} from '../entities/password-reset-request.entity';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly operatorService: OperatorService,
    private readonly branchService: BranchService,
    private readonly membershipService: MembershipService,
    @InjectRepository(PasswordResetRequest)
    private readonly passwordResetRequestRepository: Repository<PasswordResetRequest>,
  ) {}

  async validateOAuthUser(profile: GoogleProfile): Promise<AuthUser> {
    const email = profile.emails[0].value;

    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      const role = await this.userService.getEffectiveRole(existingUser.id);
      return {
        id: existingUser.id,
        email: existingUser.email,
        role,
        callSign: existingUser.operator?.callSign,
        provider: existingUser.provider,
        providerId: existingUser.providerId,
        fullName: existingUser.fullName,
        picture: existingUser.picture,
      };
    }

    const createdUser = await this.userService.create(
      {
        email,
        fullName: [profile.name.givenName, profile.name.familyName]
          .filter(Boolean)
          .join(' '),
        picture: profile.photos[0]?.value || null,
        providerId: profile.id,
        provider: 'google',
      },
      email,
    );

    const hqBranch = await this.branchService.findHeadquarters();
    if (hqBranch && createdUser.role !== Role.GUEST) {
      await this.membershipService.createMembership(
        createdUser.id,
        hqBranch.id,
        BranchRole.VOLUNTEER,
        MembershipStatus.APPROVED,
        email,
      );
    }

    const role = await this.userService.getEffectiveRole(createdUser.id);
    return {
      id: createdUser.id,
      email: createdUser.email,
      role,
      callSign: createdUser.operator?.callSign,
      provider: createdUser.provider,
      providerId: createdUser.providerId,
      fullName: createdUser.fullName,
      picture: createdUser.picture,
    };
  }

  async validateLocalUser(
    identifier: string,
    password: string,
  ): Promise<AuthUser> {
    const user = await this.userService.validate(identifier, password);
    const role = await this.userService.getEffectiveRole(user.id);

    return {
      id: user.id,
      email: user.email,
      role,
      callSign: user.operator?.callSign,
      provider: user.provider,
      isTemporaryPassword: user.isTemporaryPassword,
    };
  }

  login(user: AuthUser): { access_token: string } {
    return this.generateToken(user);
  }

  generateToken(user: AuthUser): { access_token: string } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      provider: user.provider,
      role: user.role,
      callSign: user.callSign,
    };

    return { access_token: this.jwtService.sign(payload) };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('error.userAlreadyExists');
    }

    const uniqueBranchIds = [...new Set(dto.branchIds)];
    for (const branchId of uniqueBranchIds) {
      try {
        await this.branchService.findOne(branchId);
      } catch {
        throw new BadRequestException('error.branchNotFound');
      }
    }

    const operator = await this.operatorService.create(
      {
        callSign: (dto.callSign ?? '').trim(),
        city: (dto.city ?? '').trim() || undefined,
        country: (dto.country ?? '').trim() || undefined,
        district: (dto.district ?? '').trim() || undefined,
        fullName: (dto.fullName ?? '').trim() || undefined,
      },
      dto.email,
    );

    const user = await this.userService.create(
      {
        email: dto.email,
        password: dto.password,
        salt: crypto.randomBytes(16).toString('hex'),
        fullName: dto.fullName,
        provider: 'local',
        operator: operator,
      },
      dto.email,
    );

    const hqBranch = await this.branchService.findHeadquarters();
    if (hqBranch && user.role !== Role.GUEST) {
      await this.membershipService.createMembership(
        user.id,
        hqBranch.id,
        BranchRole.VOLUNTEER,
        MembershipStatus.APPROVED,
        dto.email,
      );
    }

    for (const branchId of uniqueBranchIds) {
      if (branchId !== hqBranch?.id) {
        await this.membershipService.join(user.id, branchId);
      }
    }
  }

  async createPasswordResetRequest(callSign: string): Promise<void> {
    const normalizedCallSign = callSign.toUpperCase();

    const existingPending = await this.passwordResetRequestRepository.findOne({
      where: {
        callSign: normalizedCallSign,
        status: PasswordResetStatus.PENDING,
      },
    });

    if (existingPending) {
      this.logger.log(
        `Password reset request already pending for ${normalizedCallSign}`,
      );
      return;
    }

    const operator =
      await this.operatorService.findByCallSign(normalizedCallSign);

    if (!operator) {
      this.logger.warn(
        `Password reset requested for unknown call sign: ${normalizedCallSign}`,
      );
    }

    const request = this.passwordResetRequestRepository.create({
      callSign: normalizedCallSign,
      operator: operator || null,
      operatorId: operator?.id || null,
      status: PasswordResetStatus.PENDING,
    });

    await this.passwordResetRequestRepository.save(request);
  }

  async getPendingPasswordResetRequests(): Promise<PasswordResetRequest[]> {
    return this.passwordResetRequestRepository.find({
      where: { status: PasswordResetStatus.PENDING },
      relations: ['operator'],
      order: { createdAt: 'ASC' },
    });
  }

  async getPendingPasswordResetRequestsCount(): Promise<number> {
    return this.passwordResetRequestRepository.count({
      where: { status: PasswordResetStatus.PENDING },
    });
  }

  async approvePasswordResetRequest(
    requestId: string,
    adminId: string,
  ): Promise<{ newPassword: string }> {
    const request = await this.passwordResetRequestRepository.findOne({
      where: { id: requestId, status: PasswordResetStatus.PENDING },
      relations: ['operator', 'operator.user'],
    });

    if (!request) {
      throw new ConflictException('error.requestNotFound');
    }

    if (!request.operator?.user) {
      throw new ConflictException('error.userNotFound');
    }

    const newPassword = this.generateRandomPassword();
    await this.userService.forceSetPassword(
      request.operator.user.id,
      newPassword,
    );

    request.status = PasswordResetStatus.COMPLETED;
    request.processedBy = adminId;
    request.processedAt = new Date();
    await this.passwordResetRequestRepository.save(request);

    this.logger.log(
      `Password reset approved for ${request.callSign} by admin ${adminId}`,
    );

    return { newPassword };
  }

  async rejectPasswordResetRequest(
    requestId: string,
    adminId: string,
  ): Promise<void> {
    const request = await this.passwordResetRequestRepository.findOne({
      where: { id: requestId, status: PasswordResetStatus.PENDING },
    });

    if (!request) {
      throw new ConflictException('error.requestNotFound');
    }

    request.status = PasswordResetStatus.REJECTED;
    request.processedBy = adminId;
    request.processedAt = new Date();
    await this.passwordResetRequestRepository.save(request);

    this.logger.log(
      `Password reset rejected for ${request.callSign} by admin ${adminId}`,
    );
  }

  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
