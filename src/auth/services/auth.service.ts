import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  AuthUser,
  JwtPayload,
  PendingSsoRegistration,
} from '../types/auth.types';
import { UserService } from 'src/user/services/user.service';
import { GoogleProfile } from '../types/auth.types';
import { RegisterDto } from '../dto/register.dto';
import { CompleteSsoRegistrationDto } from '../dto/complete-sso-registration.dto';
import { OperatorService } from '../../operator/services/operator.service';
import { BranchService } from '../../branch/services/branch.service';
import { MembershipService } from '../../branch/services/membership.service';
import {
  PasswordResetRequest,
  PasswordResetStatus,
} from '../entities/password-reset-request.entity';
import * as crypto from 'crypto';
import {
  extractPlainCallSign,
  isValidCallSignFormat,
  normalizePlainCallSign,
} from '../../shared/utils/call-sign.util';

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

  async validateOAuthUser(
    profile: GoogleProfile,
  ): Promise<AuthUser | PendingSsoRegistration> {
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

    // Do not create user until they complete registration (operator + privacy)
    const fullName = [profile.name.givenName, profile.name.familyName]
      .filter(Boolean)
      .join(' ');
    const picture = profile.photos[0]?.value || null;
    return {
      pendingSso: true,
      email,
      fullName: fullName || email,
      picture,
      providerId: profile.id,
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

  async completeSsoRegistration(
    pending: PendingSsoRegistration,
    dto: CompleteSsoRegistrationDto,
  ): Promise<AuthUser> {
    if (dto.privacyAccepted !== true) {
      throw new BadRequestException('error.privacyAcceptRequired');
    }

    const callSignRaw = (dto.callSign ?? '').trim();
    if (!isValidCallSignFormat(callSignRaw, { allowSlashes: false })) {
      throw new BadRequestException('error.callSignPlainOnly');
    }

    const operator = await this.operatorService.create(
      {
        callSign: normalizePlainCallSign(callSignRaw),
        city: (dto.city ?? '').trim() || undefined,
        country: (dto.country ?? '').trim() || undefined,
        district: (dto.district ?? '').trim() || undefined,
        fullName: (dto.fullName ?? '').trim() || undefined,
        gridSquare: (dto.gridSquare ?? '').trim()
          ? (dto.gridSquare ?? '').trim().toUpperCase()
          : undefined,
      },
      pending.email,
    );

    const user = await this.userService.create(
      {
        email: pending.email,
        fullName: pending.fullName,
        picture: pending.picture,
        providerId: pending.providerId,
        provider: 'google',
        operator,
        privacyAcceptedAt: new Date(),
      },
      pending.email,
    );

    await this.operatorService.linkToUser(operator.id, user.id);

    const hqBranch = await this.branchService.findHeadquarters();
    if (hqBranch) {
      await this.membershipService.join(user.id, hqBranch.id);
    }

    const role = await this.userService.getEffectiveRole(user.id);
    return {
      id: user.id,
      email: user.email,
      role,
      callSign: user.operator?.callSign,
      provider: user.provider,
      providerId: user.providerId,
      fullName: user.fullName,
      picture: user.picture,
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

    if (dto.privacyAccepted !== true) {
      throw new BadRequestException('error.privacyAcceptRequired');
    }

    const callSignRaw = (dto.callSign ?? '').trim();
    if (!isValidCallSignFormat(callSignRaw, { allowSlashes: false })) {
      throw new BadRequestException('error.callSignPlainOnly');
    }

    const operator = await this.operatorService.create(
      {
        callSign: normalizePlainCallSign(callSignRaw),
        city: (dto.city ?? '').trim() || undefined,
        country: (dto.country ?? '').trim() || undefined,
        district: (dto.district ?? '').trim() || undefined,
        fullName: (dto.fullName ?? '').trim() || undefined,
        gridSquare: (dto.gridSquare ?? '').trim()
          ? (dto.gridSquare ?? '').trim().toUpperCase()
          : undefined,
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
        privacyAcceptedAt: new Date(),
      },
      dto.email,
    );

    const hqBranch = await this.branchService.findHeadquarters();
    if (hqBranch) {
      await this.membershipService.join(user.id, hqBranch.id);
    }

    for (const branchId of uniqueBranchIds) {
      if (branchId !== hqBranch?.id) {
        await this.membershipService.join(user.id, branchId);
      }
    }
  }

  async createPasswordResetRequest(callSign: string): Promise<void> {
    const plainCallSign = extractPlainCallSign((callSign ?? '').trim());
    if (!plainCallSign) {
      return;
    }

    const existingPending = await this.passwordResetRequestRepository.findOne({
      where: {
        callSign: plainCallSign,
        status: PasswordResetStatus.PENDING,
      },
    });

    if (existingPending) {
      this.logger.log(
        `Password reset request already pending for ${plainCallSign}`,
      );
      return;
    }

    const operator =
      await this.operatorService.findByCallSign(plainCallSign);

    if (!operator) {
      this.logger.warn(
        `Password reset requested for unknown call sign: ${plainCallSign}`,
      );
      return;
    }

    const request = this.passwordResetRequestRepository.create({
      callSign: plainCallSign,
      operator,
      operatorId: operator.id,
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
    newPassword: string,
  ): Promise<void> {
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

}
