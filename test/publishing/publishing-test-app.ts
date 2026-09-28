import {
  ClassSerializerInterceptor,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as cookieParser from 'cookie-parser';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { MembershipService } from '../../src/branch/services/membership.service';
import { DisasterController } from '../../src/disaster/controllers/disaster.controller';
import {
  Disaster,
  DisasterMembership,
  Observation,
  ObservationPhoto,
} from '../../src/disaster/entities';
import { DisasterAdminGuard } from '../../src/disaster/guards/disaster-admin.guard';
import {
  DisasterMembershipService,
  DisasterService,
  ObservationScoringService,
  ObservationService,
} from '../../src/disaster/services';
import { controllers as publishingControllers } from '../../src/publishing/controllers';
import {
  PublicationQueueItem,
  PublishTarget,
} from '../../src/publishing/entities';
import { PublicationStatus } from '../../src/publishing/enums/publication-status.enum';
import { PUBLISHING_CLOCK } from '../../src/publishing/publishing.constants';
import {
  PublicationQueueClaimer,
  services as publishingServices,
} from '../../src/publishing/services';
import { EligiblePair } from '../../src/publishing/services/publication-queue-claimer';
import { HttpExceptionFilter } from '../../src/shared/filters/http-exception.filter';
import { User } from '../../src/user/entities/user.entity';
import { UserService } from '../../src/user/services/user.service';
import { InMemoryRepository } from '../oidc/in-memory-repository';
import { FakeUserService } from '../oidc/oidc-test-app';

const JWT_SECRET = 'test-session-secret';

/** InMemoryRepository plus the `count` the publishing services use. */
export class CountingRepository<
  T extends { id: string },
> extends InMemoryRepository<T> {
  /** Set by the test app: the shared in-memory EntityManager. */
  manager: unknown;

  async count(options: { where?: Partial<T> } = {}): Promise<number> {
    return (await this.find({ where: options.where })).length;
  }
}

/**
 * Stand-in for TypeORM's EntityManager over the in-memory repositories.
 * `transaction` restores every repository's rows when the work throws, as a
 * database rollback would.
 */
class InMemoryEntityManager {
  constructor(
    private readonly repositories: Map<unknown, InMemoryRepository<any>>,
  ) {}

  getRepository(entity: unknown): InMemoryRepository<any> {
    const repository = this.repositories.get(entity);
    if (!repository) throw new Error('No in-memory repository for entity');
    return repository;
  }

  async transaction<R>(
    work: (manager: InMemoryEntityManager) => Promise<R>,
  ): Promise<R> {
    const snapshot = [...this.repositories.values()].map(
      (repository): [InMemoryRepository<any>, any[]] => [
        repository,
        [...repository.rows],
      ],
    );
    try {
      return await work(this);
    } catch (error) {
      for (const [repository, rows] of snapshot) repository.rows = rows;
      throw error;
    }
  }
}

/**
 * The claim the production claimer does in SQL (`FOR UPDATE SKIP LOCKED`),
 * over the in-memory rows: due, pending rows of the eligible pairs, leased.
 */
class InMemoryClaimer {
  constructor(
    private readonly repo: InMemoryRepository<PublicationQueueItem>,
  ) {}

  async claim(
    now: Date,
    leaseUntil: Date,
    limit: number,
    pairs: EligiblePair[],
  ): Promise<PublicationQueueItem[]> {
    const due = this.repo.rows
      .filter(
        (r) =>
          r.status === PublicationStatus.PENDING &&
          r.nextAttemptAt.getTime() <= now.getTime() &&
          pairs.some(
            (p) => p.disasterId === r.disasterId && p.targetId === r.targetId,
          ),
      )
      .sort(
        (a, b) =>
          a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime() ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      )
      .slice(0, limit);
    for (const row of due) row.nextAttemptAt = leaseUntil;
    return due.map((r) => ({ ...r }));
  }
}

/** Only what ObservationService and DisasterAdminGuard need from DisasterService. */
class FakeDisasterService {
  constructor(private readonly repo: InMemoryRepository<Disaster>) {}

  async findOne(id: string): Promise<Disaster> {
    const disaster = await this.repo.findOne({ where: { id } });
    if (!disaster) throw new NotFoundException('error.notFound');
    return disaster;
  }

  assertNotArchived(): void {}
}

export interface PublishingTestApp {
  app: INestApplication;
  users: FakeUserService;
  clock: { now: Date };
  repos: {
    disasters: CountingRepository<Disaster>;
    memberships: CountingRepository<DisasterMembership>;
    observations: CountingRepository<Observation>;
    targets: CountingRepository<PublishTarget>;
    queue: CountingRepository<PublicationQueueItem>;
  };
  sessionCookie(user: User): string;
}

export async function createPublishingTestApp(): Promise<PublishingTestApp> {
  const users = new FakeUserService();
  const clock = { now: new Date('2026-09-28T09:00:00Z') };
  const repos = {
    disasters: new CountingRepository<Disaster>(),
    memberships: new CountingRepository<DisasterMembership>(),
    observations: new CountingRepository<Observation>(),
    targets: new CountingRepository<PublishTarget>(),
    queue: new CountingRepository<PublicationQueueItem>([
      'observationId',
      'targetId',
    ]),
  };

  const manager = new InMemoryEntityManager(
    new Map<unknown, InMemoryRepository<any>>([
      [Disaster, repos.disasters],
      [DisasterMembership, repos.memberships],
      [Observation, repos.observations],
      [PublishTarget, repos.targets],
      [PublicationQueueItem, repos.queue],
    ]),
  );
  for (const repository of Object.values(repos)) repository.manager = manager;

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
        load: [() => ({ JWT_SECRET })],
      }),
      PassportModule,
    ],
    controllers: [DisasterController, ...publishingControllers],
    providers: [
      ...publishingServices,
      ObservationService,
      DisasterMembershipService,
      DisasterAdminGuard,
      JwtStrategy,
      { provide: EventEmitter2, useValue: new EventEmitter2() },
      { provide: UserService, useValue: users },
      // Only PortalOrBranchLeaderGuard (disaster creation) uses it; not exercised here.
      { provide: MembershipService, useValue: {} },
      {
        provide: DisasterService,
        useValue: new FakeDisasterService(repos.disasters),
      },
      {
        provide: ObservationScoringService,
        useValue: { recompute: async () => undefined },
      },
      { provide: PUBLISHING_CLOCK, useValue: () => clock.now },
      {
        provide: PublicationQueueClaimer,
        useValue: new InMemoryClaimer(repos.queue),
      },
      { provide: getRepositoryToken(Disaster), useValue: repos.disasters },
      {
        provide: getRepositoryToken(DisasterMembership),
        useValue: repos.memberships,
      },
      {
        provide: getRepositoryToken(Observation),
        useValue: repos.observations,
      },
      {
        provide: getRepositoryToken(ObservationPhoto),
        useValue: new CountingRepository(),
      },
      { provide: getRepositoryToken(User), useValue: new CountingRepository() },
      { provide: getRepositoryToken(PublishTarget), useValue: repos.targets },
      {
        provide: getRepositoryToken(PublicationQueueItem),
        useValue: repos.queue,
      },
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
