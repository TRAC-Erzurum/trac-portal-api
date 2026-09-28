import { randomUUID } from 'crypto';
import { FindOperator, QueryFailedError } from 'typeorm';

type Where<T> = Partial<Record<keyof T, unknown>>;

function satisfies(actual: unknown, expected: unknown): boolean {
  if (expected instanceof FindOperator) {
    if (expected.type === 'isNull')
      return actual === null || actual === undefined;
    if (expected.type === 'not') return !satisfies(actual, expected.child ?? expected.value);
    if (expected.type === 'in')
      return (expected.value as unknown[]).includes(actual);
    throw new Error(`Unsupported operator ${expected.type}`);
  }
  return actual === expected;
}

function matches<T>(row: T, where: Where<T> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) =>
    satisfies((row as Record<string, unknown>)[key], expected),
  );
}

/**
 * Just enough of TypeORM's Repository for the OIDC services, backed by an
 * array. Rows are copied on the way in and out, as a database would, and a
 * unique key is enforced the way Postgres does (QueryFailedError, code 23505).
 */
export class InMemoryRepository<T extends { id: string }> {
  rows: T[] = [];
  private tick = 0;

  constructor(
    private readonly uniqueKey: (keyof T)[] = [],
    /**
     * Stands in for the raw SQL a service sends through `query`. It runs
     * without yielding, so it is atomic the way one statement is in Postgres.
     */
    private readonly rawQuery?: (
      repository: InMemoryRepository<T>,
      sql: string,
      parameters: unknown[],
    ) => unknown,
  ) {}

  async query(sql: string, parameters: unknown[] = []): Promise<unknown> {
    if (!this.rawQuery) throw new Error(`Unexpected raw query: ${sql}`);
    return this.rawQuery(this, sql, parameters);
  }

  create(data: Partial<T>): T {
    return { ...data } as T;
  }

  async save(entity: T): Promise<T> {
    const now = new Date(Date.UTC(2026, 0, 1) + this.tick++);
    const row = { ...entity } as T & { createdAt?: Date; updatedAt?: Date };
    if (!row.id) row.id = randomUUID();
    const clash =
      this.uniqueKey.length > 0 &&
      this.rows.some(
        (r) => r.id !== row.id && this.uniqueKey.every((k) => r[k] === row[k]),
      );
    if (clash) {
      throw new QueryFailedError('INSERT', [], {
        name: 'error',
        message: 'duplicate key value violates unique constraint',
        code: '23505',
      } as Error);
    }
    row.createdAt ??= now;
    row.updatedAt = now;
    const index = this.rows.findIndex((r) => r.id === row.id);
    if (index >= 0) this.rows[index] = row;
    else this.rows.push(row);
    return { ...row };
  }

  async findOne(options: { where: Where<T> }): Promise<T | null> {
    const row = this.rows.find((r) => matches(r, options.where));
    return row ? { ...row } : null;
  }

  async find(
    options: {
      where?: Where<T>;
      order?: Partial<Record<keyof T, 'ASC' | 'DESC'>>;
    } = {},
  ): Promise<T[]> {
    const rows = this.rows
      .filter((r) => matches(r, options.where))
      .map((r) => ({ ...r }));
    const [orderKey, direction] = Object.entries(options.order ?? {})[0] ?? [];
    if (orderKey) {
      rows.sort((a, b) => {
        const av = (a as any)[orderKey];
        const bv = (b as any)[orderKey];
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return direction === 'DESC' ? -cmp : cmp;
      });
    }
    return rows;
  }

  async update(
    where: Where<T>,
    patch: Partial<T>,
  ): Promise<{ affected: number }> {
    let affected = 0;
    this.rows = this.rows.map((r) => {
      if (!matches(r, where)) return r;
      affected++;
      return { ...r, ...patch };
    });
    return { affected };
  }

  async delete(where: Where<T>): Promise<{ affected: number }> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matches(r, where));
    return { affected: before - this.rows.length };
  }
}
