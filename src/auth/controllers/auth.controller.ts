import {
  Controller,
  Get,
  UseGuards,
  Req,
  Res,
  Post,
  Body,
  Ip,
  Inject,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';
import { CaptchaService, CAPTCHA_SERVICE } from '../services/captcha.interface';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { GlobalRole } from '../enums/role.enum';
import { AuthUser, PendingSsoRegistration } from '../types/auth.types';
import { CookieOptions, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AllowWithoutCallsign } from '../decorators/allow-without-callsign.decorator';
import { RegisterDto } from '../dto/register.dto';
import { CompleteSsoRegistrationDto } from '../dto/complete-sso-registration.dto';
import { NotFoundException } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { ApprovePasswordResetDto } from '../dto/approve-password-reset.dto';
import { PasswordResetRequestDto } from '../dto/password-reset-request.dto';
import { MembershipService } from '../../branch/services/membership.service';
import { BranchService } from '../../branch/services/branch.service';
import { UserService } from '../../user/services/user.service';
import { PortalOrBranchLeaderGuard } from '../../branch/guards/portal-or-branch-leader.guard';

interface RequestWithUser extends Request {
  user: AuthUser | PendingSsoRegistration;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private membershipService: MembershipService,
    private branchService: BranchService,
    private userService: UserService,
    @Inject(CAPTCHA_SERVICE) private captchaService: CaptchaService,
    private configService: ConfigService,
  ) {}

  private getCookieOptions(): CookieOptions {
    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    };

    const domain = this.configService.get<string>('DOMAIN');
    if (domain && this.configService.get<string>('NODE_ENV') === 'production') {
      cookieOptions.domain = domain;
    }

    return cookieOptions;
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(): Promise<void> {
    // Guard redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const payload = req.user;

    if ('pendingSso' in payload && payload.pendingSso) {
      const pending = payload;
      (
        req as Request & { session: { pendingSso?: unknown } }
      ).session.pendingSso = {
        email: pending.email,
        fullName: pending.fullName,
        picture: pending.picture,
        providerId: pending.providerId,
      };
      // Explicitly save session before redirecting to ensure data persists
      return new Promise<void>((resolve) => {
        (
          req as Request & {
            session?: { save: (cb: (err?: Error) => void) => void };
          }
        ).session?.save(() => {
          res.redirect('/register/complete-sso');
          resolve();
        });
      });
    }

    const { access_token } = this.authService.login(payload as AuthUser);
    res.cookie('auth_token', access_token, this.getCookieOptions());
    res.redirect('/');
  }

  @Get('check')
  @AllowWithoutCallsign()
  async checkAuth(@Req() req: RequestWithUser) {
    const authUser = req.user as AuthUser;
    const user = await this.userService.findOne(authUser.id);
    const operator = user.operator
      ? {
          id: user.operator.id,
          callSign: user.operator.callSign,
          prefix: user.operator.prefix ?? undefined,
          suffix: user.operator.suffix ?? undefined,
          fullName: user.operator.fullName ?? undefined,
          country: user.operator.country ?? undefined,
          city: user.operator.city ?? undefined,
          district: user.operator.district ?? undefined,
          gridSquare: user.operator.gridSquare ?? undefined,
        }
      : undefined;
    const branchMemberships =
      user.operator?.branchMemberships?.map((m) => ({
        branchId: m.branchId,
        role: m.role,
        status: m.status,
        isHeadquarters: m.branch?.isHeadquarters ?? false,
      })) ?? [];

    return {
      user: {
        ...authUser,
        currentBranchId: user.currentBranchId,
        operator,
        branchMemberships,
      },
    };
  }

  @Get('logout')
  @AllowWithoutCallsign()
  logout(@Res({ passthrough: true }) res: Response) {
    const { maxAge, ...clearOptions } = this.getCookieOptions();
    res.clearCookie('auth_token', clearOptions);
  }

  @Public()
  @Get('pending-sso')
  async getPendingSsoRegistration(
    @Req() req: Request & { session: { pendingSso?: Record<string, unknown> } },
  ): Promise<{
    email: string;
    fullName: string;
    picture: string | null;
  }> {
    const data = req.session?.pendingSso;
    if (!data || typeof data !== 'object' || !data.email) {
      throw new NotFoundException('error.notFound');
    }
    return {
      email: String(data.email),
      fullName: data.fullName ? String(data.fullName) : String(data.email),
      picture: data.picture != null ? String(data.picture) : null,
    };
  }

  @Public()
  @Post('complete-sso-registration')
  async completeSsoRegistration(
    @Body() dto: CompleteSsoRegistrationDto,
    @Req() req: Request & { session: { pendingSso?: Record<string, unknown> } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = req.session?.pendingSso;
    if (!data || typeof data !== 'object' || !data.email) {
      throw new NotFoundException('error.notFound');
    }

    const pending: PendingSsoRegistration = {
      pendingSso: true,
      email: String(data.email),
      fullName: data.fullName ? String(data.fullName) : String(data.email),
      picture: data.picture != null ? String(data.picture) : null,
      providerId: data.providerId ? String(data.providerId) : '',
    };

    const authUser = await this.authService.completeSsoRegistration(
      pending,
      dto,
    );

    delete req.session.pendingSso;

    const { access_token } = this.authService.login(authUser);
    res.cookie('auth_token', access_token, this.getCookieOptions());
    return { user: authUser };
  }

  @Public()
  @Get('branches')
  async getBranchesForRegistration() {
    return this.branchService.findAll({ includeInactive: false });
  }

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    await this.captchaService.verify(dto.captchaToken, ip);
    await this.authService.register(dto);

    const authUser = await this.authService.validateLocalUser(
      dto.email,
      dto.password,
    );

    const { access_token } = this.authService.login(authUser);
    res.cookie('auth_token', access_token, this.getCookieOptions());
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    await this.captchaService.verify(dto.captchaToken, ip);

    const authUser = await this.authService.validateLocalUser(
      dto.identifier,
      dto.password,
    );

    const { access_token } = this.authService.login(authUser);
    res.cookie('auth_token', access_token, this.getCookieOptions());
    return { isTemporaryPassword: authUser.isTemporaryPassword };
  }

  @Public()
  @Post('password-reset-request')
  async passwordResetRequest(
    @Body() dto: PasswordResetRequestDto,
    @Ip() ip: string,
  ) {
    await this.captchaService.verify(dto.captchaToken, ip);
    await this.authService.createPasswordResetRequest(dto.callSign);
    return { message: 'Talebiniz alındı' };
  }

  @Get('admin/pending-requests/count')
  @UseGuards(PortalOrBranchLeaderGuard)
  @Roles(GlobalRole.GUEST)
  async getAdminPendingRequestsCount(@Req() req: RequestWithUser) {
    const userId = (req.user as AuthUser).id;
    const [membershipCount, passwordResetCount] = await Promise.all([
      this.membershipService.getPendingRequestsCountForAdmin(userId),
      this.authService.getPendingPasswordResetRequestsCount(),
    ]);
    return { total: membershipCount + passwordResetCount };
  }

  @Get('admin/pending-requests')
  @UseGuards(PortalOrBranchLeaderGuard)
  @Roles(GlobalRole.GUEST)
  async getAdminPendingRequests(@Req() req: RequestWithUser) {
    const userId = (req.user as AuthUser).id;
    const [membershipRequests, passwordResetRequests] = await Promise.all([
      this.membershipService.getPendingRequestsForAdmin(userId),
      this.authService.getPendingPasswordResetRequests(),
    ]);
    return {
      membershipRequests: membershipRequests.branches,
      passwordResetRequests,
    };
  }

  @Get('password-reset-requests')
  @UseGuards(PortalOrBranchLeaderGuard)
  @Roles(GlobalRole.GUEST)
  async getPendingPasswordResetRequests() {
    return this.authService.getPendingPasswordResetRequests();
  }

  @Get('password-reset-requests/count')
  @UseGuards(PortalOrBranchLeaderGuard)
  @Roles(GlobalRole.GUEST)
  async getPendingPasswordResetRequestsCount() {
    return {
      count: await this.authService.getPendingPasswordResetRequestsCount(),
    };
  }

  @Post('password-reset-requests/:id/approve')
  @UseGuards(PortalOrBranchLeaderGuard)
  @Roles(GlobalRole.GUEST)
  async approvePasswordResetRequest(
    @Param('id') id: string,
    @Body() dto: ApprovePasswordResetDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = (req.user as AuthUser).id;
    await this.authService.approvePasswordResetRequest(
      id,
      userId,
      dto.newPassword,
    );
  }

  @Post('password-reset-requests/:id/reject')
  @UseGuards(PortalOrBranchLeaderGuard)
  @Roles(GlobalRole.GUEST)
  async rejectPasswordResetRequest(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = (req.user as AuthUser).id;
    await this.authService.rejectPasswordResetRequest(id, userId);
    return { message: 'Request rejected' };
  }
}
