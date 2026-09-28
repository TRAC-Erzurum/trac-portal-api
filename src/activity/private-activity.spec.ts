import { Activity } from './entities/activity.entity';
import { ActivityService } from './services/activity.service';
import { DashboardService } from '../dashboard/services/dashboard.service';
import { InMemoryRepository } from '../../test/oidc/in-memory-repository';

const TAKEOVER = 'account.google_password_replaced';

function activity(type: string, userId: string): Activity {
  return {
    id: `${type}-${userId}`,
    type,
    entityType: 'user',
    entityId: userId,
    userId,
    metadata: {},
    createdAt: new Date('2026-09-28T10:00:00Z'),
  } as unknown as Activity;
}

/**
 * Enough of TypeORM's query builder to run DashboardService.getActivity on an
 * array: the SQL fragments it builds are recognised, not interpreted.
 */
function queryableActivities(rows: Activity[]) {
  return {
    createQueryBuilder: () => {
      const filters: ((a: Activity) => boolean)[] = [];
      const qb = {
        orderBy: () => qb,
        limit: () => qb,
        offset: () => qb,
        where: (sql: string, params: Record<string, unknown>) => {
          filters.push((a) => a.userId === params.userId);
          return qb;
        },
        andWhere: (sql: string, params: Record<string, string[]>) => {
          const [values] = Object.values(params);
          if (!/NOT IN/i.test(sql)) throw new Error(`Unsupported: ${sql}`);
          filters.push((a) => !values.includes(a.type));
          return qb;
        },
        getMany: async () => rows.filter((a) => filters.every((f) => f(a))),
      };
      return qb;
    },
  };
}

describe('a password replaced through Google stays out of the shared activity feeds', () => {
  const rows = [activity('net.started', 'u-1'), activity(TAKEOVER, 'u-2')];

  it('is left out of the public dashboard feed but shown in the account owner’s own feed', async () => {
    const service = new DashboardService(
      null,
      null,
      null,
      queryableActivities(rows) as never,
      null,
    );

    const global = await service.getActivity(undefined, 10, 0);
    const own = await service.getActivity('u-2', 10, 0);

    expect(global.map((a) => a.type)).toEqual(['net.started']);
    expect(own.map((a) => a.type)).toEqual([TAKEOVER]);
  });

  it('is left out of the global activity feed', async () => {
    const repo = new InMemoryRepository<Activity>();
    for (const row of rows) await repo.save(row);
    const service = new ActivityService(repo as never, null);

    const global = await service.findRecentGlobal(10);

    expect(global.map((a) => a.type)).toEqual(['net.started']);
  });
});
