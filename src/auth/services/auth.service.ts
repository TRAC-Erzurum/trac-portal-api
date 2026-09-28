import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  AuthUser,
  JwtPayload,
  PendingGoogleLink,
  PendingSsoRegistration,
} from '../types/auth.types';
import { User } from '../../user/entities/user.entity';
import {
  AUTH_CLOCK,
  AuthClock,
  GOOGLE_LINK_TTL_SECONDS,
} from '../auth.constants';
import {
  ACTIVITY_EVENT,
  ActivityEvent,
} from '../../activity/events/activity.events';
import {
  ActivityType,
  EntityType,
} from '../../activity/enums/activity-type.enum';
import { UserService } from '../../user/services/user.service';
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

const GOOGLE_LINK_PURPOSE = 'google-link';

interface GoogleLinkClaims {
  sub: string;
  email: string;
  gid: string;
  purpose: typeof GOOGLE_LINK_PURPOSE;
}

const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

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
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(AUTH_CLOCK) private readonly clock: AuthClock,
  ) {}

  async validateOAuthUser(
    profile: GoogleProfile,
  ): Promise<AuthUser | PendingSsoRegistration | PendingGoogleLink> {
    const email = profile.emails[0].value;

    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      if (!existingUser.providerId) {
        if (existingUser.password) {
          // Someone may have registered this address without owning it and
          // still know the password: nothing of the account until confirmed.
          return {
            pendingGoogleLink: true,
            userId: existingUser.id,
            email: existingUser.email,
            providerId: profile.id,
          };
        }
        await this.userService.linkGoogleIdentity(existingUser.id, profile.id);
      }
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
    await this.userService.syncRoleColumn(user.id);

    const hqBranch = await this.branchService.findHeadquarters();
    if (hqBranch) {
      const hqM = await this.membershipService.findMembership(
        user.id,
        hqBranch.id,
      );
      if (!hqM) {
        await this.membershipService.join(user.id, hqBranch.id);
      }
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

  generateToken(
    user: AuthUser,
    issuedAt: number = toSeconds(this.clock()),
  ): { access_token: string } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      provider: user.provider,
      role: user.role,
      callSign: user.callSign,
      iat: issuedAt,
    };

    return { access_token: this.jwtService.sign(payload) };
  }

  /** Signed, short-lived proof that this browser just signed in with Google. */
  createGoogleLinkToken(pending: PendingGoogleLink): string {
    const claims: GoogleLinkClaims = {
      sub: pending.userId,
      email: pending.email,
      gid: pending.providerId,
      purpose: GOOGLE_LINK_PURPOSE,
    };
    return this.jwtService.sign(
      { ...claims, iat: toSeconds(this.clock()) },
      { secret: this.googleLinkSecret(), expiresIn: GOOGLE_LINK_TTL_SECONDS },
    );
  }

  /** The address Google proved, for the confirmation screen; nothing else. */
  async getGoogleLink(token: string | undefined): Promise<{ email: string }> {
    const { user } = await this.resolveGoogleLink(token);
    return { email: user.email };
  }

  /** Choice (a): the current password proves the person registered the account. */
  async confirmGoogleLinkWithPassword(
    token: string | undefined,
    password: string,
  ): Promise<AuthUser> {
    const { user, providerId } = await this.resolveGoogleLink(token);
    if (!(await this.userService.passwordMatches(user.id, password))) {
      throw new UnauthorizedException('error.invalidCredentials');
    }
    if (!(await this.userService.linkGoogleIdentity(user.id, providerId))) {
      throw new NotFoundException('error.notFound');
    }
    return this.toAuthUser(user.id);
  }

  /**
   * Choice (b): the verified email owner takes the account. The old password
   * and every session issued before now stop working.
   */
  async confirmGoogleLinkWithNewPassword(
    token: string | undefined,
    newPassword: string,
  ): Promise<{ access_token: string; user: AuthUser }> {
    const { user, providerId } = await this.resolveGoogleLink(token);
    // Whole seconds, because JWT `iat` is whole seconds: tokens issued up to
    // and including this second are refused, the new session is not.
    const validAfterSeconds = toSeconds(this.clock()) + 1;
    const replaced = await this.userService.replacePasswordAndLinkGoogle(
      user.id,
      providerId,
      newPassword,
      new Date(validAfterSeconds * 1000),
    );
    if (!replaced) {
      throw new NotFoundException('error.notFound');
    }
    const callSign = user.operator?.callSign ?? null;
    this.eventEmitter.emit(
      ACTIVITY_EVENT,
      new ActivityEvent(
        ActivityType.ACCOUNT_GOOGLE_PASSWORD_REPLACED,
        EntityType.USER,
        user.id,
        user.id,
        callSign,
        callSign,
      ),
    );
    this.logger.log(
      `Password of user ${user.id} replaced through a verified Google sign-in`,
    );
    const authUser = await this.toAuthUser(user.id);
    return {
      ...this.generateToken(authUser, validAfterSeconds),
      user: authUser,
    };
  }

  private googleLinkSecret(): string {
    return `${this.configService.get<string>('JWT_SECRET')}:${GOOGLE_LINK_PURPOSE}`;
  }

  /**
   * The account a confirmation cookie points at, while the confirmation is
   * still open: signed, unexpired, same address, no Google identity yet.
   */
  private async resolveGoogleLink(
    token: string | undefined,
  ): Promise<{ user: User; providerId: string }> {
    let claims: GoogleLinkClaims;
    try {
      claims = this.jwtService.verify<GoogleLinkClaims>(token ?? '', {
        secret: this.googleLinkSecret(),
        clockTimestamp: toSeconds(this.clock()),
      });
    } catch {
      throw new NotFoundException('error.notFound');
    }
    if (claims.purpose !== GOOGLE_LINK_PURPOSE || !claims.gid) {
      throw new NotFoundException('error.notFound');
    }
    const user = await this.userService.findByEmail(claims.email);
    if (!user || user.id !== claims.sub || user.providerId) {
      throw new NotFoundException('error.notFound');
    }
    return { user, providerId: claims.gid };
  }

  private async toAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.userService.findOne(userId);
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
      isTemporaryPassword: user.isTemporaryPassword,
    };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.userService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('error.userAlreadyExists');
    }

    if (dto.privacyAccepted !== true) {
      throw new BadRequestException('error.privacyAcceptRequired');
    }

    const callSignRaw = (dto.callSign ?? '').trim();
    const hasCallSign = callSignRaw.length > 0;

    if (hasCallSign) {
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

      const uniqueBranchIds = [...new Set(dto.branchIds ?? [])];
      const approvedCount =
        await this.membershipService.countApprovedMembershipsForOperator(
          operator.id,
        );
      if (approvedCount === 0 && uniqueBranchIds.length === 0) {
        throw new BadRequestException('error.atLeastOneBranchRequired');
      }

      for (const branchId of uniqueBranchIds) {
        try {
          await this.branchService.findOne(branchId);
        } catch {
          throw new BadRequestException('error.branchNotFound');
        }
      }

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

      await this.userService.syncRoleColumn(user.id);

      const hqBranch = await this.branchService.findHeadquarters();
      if (hqBranch) {
        const hqM = await this.membershipService.findMembership(
          user.id,
          hqBranch.id,
        );
        if (!hqM) {
          await this.membershipService.join(user.id, hqBranch.id);
        }
      }

      for (const branchId of uniqueBranchIds) {
        if (branchId === hqBranch?.id) {
          continue;
        }
        const existing = await this.membershipService.findMembership(
          user.id,
          branchId,
        );
        if (!existing) {
          await this.membershipService.join(user.id, branchId);
        }
      }
      return;
    }

    await this.userService.create(
      {
        email: dto.email,
        password: dto.password,
        salt: crypto.randomBytes(16).toString('hex'),
        fullName: dto.fullName,
        provider: 'local',
        privacyAcceptedAt: new Date(),
      },
      dto.email,
    );
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

    const operator = await this.operatorService.findByCallSign(plainCallSign);

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
