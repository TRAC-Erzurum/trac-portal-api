import {
  ClassSerializerInterceptor,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { BranchRole, GlobalRole } from '../../src/auth/enums/role.enum';
import { MembershipStatus } from '../../src/branch/enums/membership-status.enum';
import { HttpExceptionFilter } from '../../src/shared/filters/http-exception.filter';
import { User } from '../../src/user/entities/user.entity';
import { UserService } from '../../src/user/services/user.service';
import { controllers } from '../../src/oidc/controllers';
import { services } from '../../src/oidc/services';
import { OidcAccessToken } from '../../src/oidc/entities/oidc-access-token.entity';
import { OidcAuthorizationCode } from '../../src/oidc/entities/oidc-authorization-code.entity';
import { OidcClient } from '../../src/oidc/entities/oidc-client.entity';
import { OidcConsent } from '../../src/oidc/entities/oidc-consent.entity';
import { OidcSigningKey } from '../../src/oidc/entities/oidc-signing-key.entity';
import { OIDC_CLOCK } from '../../src/oidc/oidc.constants';
import { OidcRequestLogModule } from '../../src/oidc/oidc-logging';
import { InMemoryRepository } from './in-memory-repository';

export const PUBLIC_API_ORIGIN = 'https://portal.example.org';
export const ISSUER = `${PUBLIC_API_ORIGIN}/api/oidc`;
const JWT_SECRET = 'test-session-secret';

export interface TestUserSpec {
  email: string;
  provider: 'google' | 'local';
  /** Recorded Google identity; Google-created accounts always carry one. */
  providerId?: string | null;
  fullName?: string;
  callSign?: string | null;
  memberships?: { status: MembershipStatus; role: BranchRole }[];
  globalRole?: GlobalRole;
}

/** Stand-in for UserService: the OIDC module and JwtStrategy only read users. */
export class FakeUserService {
  users = new Map<string, User>();

  add(spec: TestUserSpec): User {
    const id = randomUUID();
    const operator =
      spec.callSign === null || spec.callSign === undefined
        ? undefined
        : {
            id: randomUUID(),
            callSign: spec.callSign,
            fullName: spec.fullName,
            branchMemberships: (spec.memberships ?? []).map((m) => ({
              id: randomUUID(),
              branchId: randomUUID(),
              operatorId: 'op',
              status: m.status,
              role: m.role,
              branch: {
                id: randomUUID(),
                name: 'Erzurum',
                isHeadquarters: false,
              },
            })),
          };
    const user = {
      id,
      email: spec.email,
      provider: spec.provider,
      providerId:
        spec.providerId !== undefined
          ? spec.providerId
          : spec.provider === 'google'
            ? `google-${id}`
            : null,
      fullName: spec.fullName ?? null,
      globalRole: spec.globalRole ?? GlobalRole.GUEST,
      role: GlobalRole.GUEST,
      operator,
    } as unknown as User;
    this.users.set(id, user);
    return user;
  }

  async exists(id: string) {
    return this.users.has(id);
  }

  async findOne(id: string): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new NotFoundException();
    return structuredClone(user);
  }

  async getEffectiveRole(id: string) {
    const user = this.users.get(id);
    if (!user) return GlobalRole.GUEST;
    if (user.globalRole === GlobalRole.SUPER_ADMIN)
      return GlobalRole.SUPER_ADMIN;
    const approved = (user.operator?.branchMemberships ?? []).filter(
      (m) => m.status === MembershipStatus.APPROVED,
    );
    return approved[0]?.role ?? GlobalRole.GUEST;
  }
}

/**
 * What OidcService's consent scope merge statement does in Postgres: append
 * the requested scopes the row lacks and the approving user to updatedBy, and
 * return the updated row's id the way TypeORM returns an UPDATE: [rows, count].
 */
function mergeConsentScopes(
  repository: InMemoryRepository<OidcConsent>,
  sql: string,
  [scopes, updatedBy, userId, clientId]: unknown[],
): [{ id: string }[], number] {
  if (!/^\s*UPDATE "oidc_consents"/.test(sql)) {
    throw new Error(`Unexpected raw query: ${sql}`);
  }
  const row = repository.rows.find(
    (r) => r.userId === userId && r.clientId === clientId,
  );
  if (!row) return [[], 0];
  row.scope = [
    ...new Set([
      ...row.scope.split(' ').filter(Boolean),
      ...(scopes as string[]).filter(Boolean),
    ]),
  ].join(' ');
  row.updatedBy = [...(row.updatedBy ?? []), updatedBy as string];
  row.updatedAt = new Date();
  return [[{ id: row.id }], 1];
}

export interface OidcTestApp {
  app: INestApplication;
  users: FakeUserService;
  clock: { now: Date };
  repos: {
    clients: InMemoryRepository<OidcClient>;
    keys: InMemoryRepository<OidcSigningKey>;
    consents: InMemoryRepository<OidcConsent>;
    codes: InMemoryRepository<OidcAuthorizationCode>;
    accessTokens: InMemoryRepository<OidcAccessToken>;
  };
  /** `Cookie` header value carrying a portal session for the user. */
  sessionCookie(user: User): string;
}

export async function createOidcTestApp(): Promise<OidcTestApp> {
  const users = new FakeUserService();
  const clock = { now: new Date('2026-09-26T10:00:00Z') };
  const repos = {
    clients: new InMemoryRepository<OidcClient>(),
    keys: new InMemoryRepository<OidcSigningKey>(),
    consents: new InMemoryRepository<OidcConsent>(
      ['userId', 'clientId'],
      mergeConsentScopes,
    ),
    codes: new InMemoryRepository<OidcAuthorizationCode>(),
    accessTokens: new InMemoryRepository<OidcAccessToken>(),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
        load: [() => ({ JWT_SECRET, PUBLIC_API_ORIGIN })],
      }),
      PassportModule,
      // Same limits as AppModule.
      ThrottlerModule.forRoot({
        throttlers: [{ name: 'default', ttl: 60000, limit: 100 }],
      }),
      JwtModule.register({}),
      OidcRequestLogModule,
    ],
    controllers: [...controllers],
    providers: [
      ...services,
      JwtStrategy,
      { provide: UserService, useValue: users },
      { provide: OIDC_CLOCK, useValue: () => clock.now },
      { provide: getRepositoryToken(OidcClient), useValue: repos.clients },
      { provide: getRepositoryToken(OidcSigningKey), useValue: repos.keys },
      { provide: getRepositoryToken(OidcConsent), useValue: repos.consents },
      {
        provide: getRepositoryToken(OidcAuthorizationCode),
        useValue: repos.codes,
      },
      {
        provide: getRepositoryToken(OidcAccessToken),
        useValue: repos.accessTokens,
      },
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

  const sessionSigner = new JwtService({ secret: JWT_SECRET });
  return {
    app,
    users,
    clock,
    repos,
    sessionCookie: (user: User) =>
      `auth_token=${sessionSigner.sign({
        sub: user.id,
        email: user.email,
        provider: user.provider,
        role: user.globalRole,
      })}`,
  };
}
