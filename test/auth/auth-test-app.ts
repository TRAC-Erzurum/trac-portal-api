import {
  ClassSerializerInterceptor,
  INestApplication,
  Injectable,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule, PassportStrategy } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as cookieParser from 'cookie-parser';
import { Request } from 'express';
import { Strategy as PassportBaseStrategy } from 'passport';
import { AuthController } from '../../src/auth/controllers/auth.controller';
import { AuthService } from '../../src/auth/services/auth.service';
import { CAPTCHA_SERVICE } from '../../src/auth/services/captcha.interface';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { PasswordResetRequest } from '../../src/auth/entities/password-reset-request.entity';
import { GoogleProfile } from '../../src/auth/types/auth.types';
import {
  ACTIVITY_EVENT,
  ActivityEvent,
} from '../../src/activity/events/activity.events';
import { BranchService } from '../../src/branch/services/branch.service';
import { MembershipService } from '../../src/branch/services/membership.service';
import { OperatorBranchMembership } from '../../src/branch/entities/operator-branch-membership.entity';
import { OperatorService } from '../../src/operator/services/operator.service';
import { HttpExceptionFilter } from '../../src/shared/filters/http-exception.filter';
import { User } from '../../src/user/entities/user.entity';
import { UserService } from '../../src/user/services/user.service';
import { InMemoryUserRepository } from './user-repository';

const JWT_SECRET = 'test-session-secret';
export const GOOGLE_PROFILE_HEADER = 'x-test-google-profile';
/** Captcha token the fake captcha rejects, standing in for a failed Turnstile check. */
export const FAILING_CAPTCHA = 'failing-captcha';

/**
 * Stands in for passport-google-oauth20: instead of the round trip to Google,
 * the profile Google would return arrives base64-encoded in a request header.
 */
class HeaderProfileStrategy extends PassportBaseStrategy {
  name = 'google';
  constructor(
    private readonly verify: (
      profile: GoogleProfile,
      done: (err: unknown, user?: unknown) => void,
    ) => void,
  ) {
    super();
  }
  authenticate(req: Request) {
    const raw = req.headers[GOOGLE_PROFILE_HEADER];
    if (typeof raw !== 'string') return this.fail(401);
    this.verify(
      JSON.parse(Buffer.from(raw, 'base64').toString()) as GoogleProfile,
      (err, user) => (err ? this.error(err) : this.success(user)),
    );
  }
}

@Injectable()
class TestGoogleStrategy extends PassportStrategy(
  HeaderProfileStrategy,
  'google',
) {
  constructor(private readonly authService: AuthService) {
    super();
  }
  validate(profile: GoogleProfile) {
    return this.authService.validateOAuthUser(profile);
  }
}

export interface AuthTestApp {
  app: INestApplication;
  users: UserService;
  userRows: InMemoryUserRepository;
  clock: { now: Date };
  activities: ActivityEvent[];
  /** A session cookie signed as the portal signs them, issued at `issuedAt`. */
  sessionCookie(user: User, issuedAt: Date): string;
}

export async function createAuthTestApp(): Promise<AuthTestApp> {
  const userRows = new InMemoryUserRepository();
  // Session JWTs are checked for expiry against the real clock, so the test
  // clock starts at the real time and only ever moves forward.
  const clock = { now: new Date() };
  const activities: ActivityEvent[] = [];

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
        load: [() => ({ JWT_SECRET })],
      }),
      PassportModule,
      EventEmitterModule.forRoot(),
      // Same limits as AppModule.
      ThrottlerModule.forRoot({
        throttlers: [{ name: 'default', ttl: 60000, limit: 100 }],
      }),
      JwtModule.register({
        secret: JWT_SECRET,
        signOptions: { expiresIn: '24h' },
      }),
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      UserService,
      JwtStrategy,
      TestGoogleStrategy,
      // AUTH_CLOCK in src/auth/auth.constants.ts
      { provide: 'AUTH_CLOCK', useValue: () => clock.now },
      {
        provide: CAPTCHA_SERVICE,
        useValue: {
          verify: async (token?: string) => {
            if (token === FAILING_CAPTCHA)
              throw new BadRequestException('error.captchaFailed');
          },
        },
      },
      { provide: getRepositoryToken(User), useValue: userRows },
      {
        provide: getRepositoryToken(OperatorBranchMembership),
        useValue: { find: async () => [] },
      },
      { provide: getRepositoryToken(PasswordResetRequest), useValue: {} },
      {
        provide: OperatorService,
        useValue: { findByUserId: async () => null },
      },
      { provide: BranchService, useValue: {} },
      { provide: MembershipService, useValue: {} },
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transformOptions: { enableImplicitConversion: true },
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  await app.init();

  app
    .get(EventEmitter2)
    .on(ACTIVITY_EVENT, (event: ActivityEvent) => activities.push(event));

  const sessionSigner = new JwtService({ secret: JWT_SECRET });
  return {
    app,
    users: app.get(UserService),
    userRows,
    clock,
    activities,
    sessionCookie: (user: User, issuedAt: Date) =>
      `auth_token=${sessionSigner.sign(
        {
          sub: user.id,
          email: user.email,
          provider: user.provider,
          role: user.globalRole,
          iat: Math.floor(issuedAt.getTime() / 1000),
        },
        { expiresIn: '24h' },
      )}`,
  };
}
