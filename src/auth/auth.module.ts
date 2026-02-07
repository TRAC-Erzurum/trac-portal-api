import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { TurnstileService } from './services/turnstile.service';
import { CAPTCHA_SERVICE } from './services/captcha.interface';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { UserModule } from '../user/user.module';
import { RolesGuard } from './guards/roles.guard';
import { OperatorModule } from '../operator/operator.module';
import { BranchModule } from '../branch/branch.module';
import { PasswordResetRequest } from './entities/password-reset-request.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([PasswordResetRequest]),
    UserModule,
    OperatorModule,
    BranchModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
      session: true,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: CAPTCHA_SERVICE, useClass: TurnstileService },
    JwtStrategy,
    GoogleStrategy,
    RolesGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
