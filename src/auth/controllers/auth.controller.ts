import {
  Controller,
  Get,
  UseGuards,
  Req,
  Res,
  Post,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';
import { Public } from '../decorators/public.decorator';
import { AuthUser } from '../types/auth.types';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AllowWithoutCallsign } from '../decorators/allow-without-callsign.decorator';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
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
  ) {
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
  ) {
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
  }
}
