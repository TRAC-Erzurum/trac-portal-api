import { EntityNotFoundError } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';
import { InMemoryRepository } from '../oidc/in-memory-repository';

/**
 * The users table for the real UserService: the in-memory repository plus the
 * few extra calls UserService makes on the sign-in paths, including the one
 * query-builder query `validate` runs (email or call sign, case-insensitive).
 */
export class InMemoryUserRepository extends InMemoryRepository<User> {
  async count(): Promise<number> {
    return this.rows.length;
  }

  async exists(options: { where: Partial<User> }): Promise<boolean> {
    return (await this.findOne(options)) !== null;
  }

  async findOneOrFail(options: { where: Partial<User> }): Promise<User> {
    const row = await this.findOne(options);
    if (!row) throw new EntityNotFoundError(User, options);
    return row;
  }

  createQueryBuilder() {
    const identifiers: string[] = [];
    const builder = {
      leftJoinAndSelect: () => builder,
      where: (_sql: string, params: { identifier: string }) => {
        identifiers.push(params.identifier);
        return builder;
      },
      orWhere: (_sql: string, params: { identifier: string }) => {
        identifiers.push(params.identifier);
        return builder;
      },
      getOne: async (): Promise<User | null> => {
        const row = this.rows.find((u) =>
          identifiers.some(
            (id) =>
              u.email?.toLowerCase() === id ||
              u.operator?.callSign?.toLowerCase() === id,
          ),
        );
        return row ? { ...row } : null;
      },
    };
    return builder;
  }
}
