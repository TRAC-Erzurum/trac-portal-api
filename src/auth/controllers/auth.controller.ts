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

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    @Inject(CAPTCHA_SERVICE) private captchaService: CaptchaService,
    private configService: ConfigService,
  ) {}

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

    res.cookie('auth_token', access_token, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      domain: this.configService.get<string>('DOMAIN'),
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.redirect('/');
  }

  @Get('check')
  @AllowWithoutCallsign()
  checkAuth(@Req() req: RequestWithUser) {
    return { user: req.user };
  }

  @Get('logout')
  @AllowWithoutCallsign()
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('auth_token');
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

    res.cookie('auth_token', access_token, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      domain: this.configService.get<string>('DOMAIN'),
      maxAge: 24 * 60 * 60 * 1000,
    });
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

    res.cookie('auth_token', access_token, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      domain: this.configService.get<string>('DOMAIN'),
      maxAge: 24 * 60 * 60 * 1000,
    });

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
