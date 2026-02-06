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
import { Role } from '../enums/role.enum';
import { AuthUser } from '../types/auth.types';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AllowWithoutCallsign } from '../decorators/allow-without-callsign.decorator';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { PasswordResetRequestDto } from '../dto/password-reset-request.dto';
import { MembershipService } from '../../branch/services/membership.service';
import { BranchService } from '../../branch/services/branch.service';
import { UserService } from '../../user/services/user.service';

interface RequestWithUser extends Request {
  user: AuthUser;
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

  private getCookieOptions() {
    const cookieOptions: any = {
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
    const { access_token } = this.authService.login(req.user);
    res.cookie('auth_token', access_token, this.getCookieOptions());
    res.redirect('/');
  }

  @Get('check')
  @AllowWithoutCallsign()
  async checkAuth(@Req() req: RequestWithUser) {
    const user = await this.userService.findOne(req.user.id);
    return { 
      user: {
        ...req.user,
        currentBranchId: user.currentBranchId,
      }
    };
  }

  @Get('logout')
  @AllowWithoutCallsign()
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('auth_token');
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
  @Roles(Role.ADMIN)
  async getAdminPendingRequestsCount(@Req() req: RequestWithUser) {
    const [membershipCount, passwordResetCount] = await Promise.all([
      this.membershipService.getPendingRequestsCountForAdmin(req.user.id),
      this.authService.getPendingPasswordResetRequestsCount(),
    ]);
    return { total: membershipCount + passwordResetCount };
  }

  @Get('admin/pending-requests')
  @Roles(Role.ADMIN)
  async getAdminPendingRequests(@Req() req: RequestWithUser) {
    const [membershipRequests, passwordResetRequests] = await Promise.all([
      this.membershipService.getPendingRequestsForAdmin(req.user.id),
      this.authService.getPendingPasswordResetRequests(),
    ]);
    return {
      membershipRequests: membershipRequests.branches,
      passwordResetRequests,
    };
  }

  @Get('password-reset-requests')
  @Roles(Role.ADMIN)
  async getPendingPasswordResetRequests() {
    return this.authService.getPendingPasswordResetRequests();
  }

  @Get('password-reset-requests/count')
  @Roles(Role.ADMIN)
  async getPendingPasswordResetRequestsCount() {
    return { count: await this.authService.getPendingPasswordResetRequestsCount() };
  }

  @Post('password-reset-requests/:id/approve')
  @Roles(Role.ADMIN)
  async approvePasswordResetRequest(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.authService.approvePasswordResetRequest(id, req.user.id);
  }

  @Post('password-reset-requests/:id/reject')
  @Roles(Role.ADMIN)
  async rejectPasswordResetRequest(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    await this.authService.rejectPasswordResetRequest(id, req.user.id);
    return { message: 'Request rejected' };
  }
}
