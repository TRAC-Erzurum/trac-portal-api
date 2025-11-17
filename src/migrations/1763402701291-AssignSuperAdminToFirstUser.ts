import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssignSuperAdminToFirstUser1763402701291 implements MigrationInterface {
  name = 'AssignSuperAdminToFirstUser1763402701291';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const firstUser = await queryRunner.query(
      `SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1`,
    );

    if (firstUser?.length > 0) {
      const userId = firstUser[0].id;
      await queryRunner.query(
        `DO $migration$
        BEGIN
          EXECUTE format('UPDATE "users" SET "role" = CAST(%L AS %I) WHERE "id" = %L', 'super_admin', 'users_role_enum', '${userId}');
        END $migration$;`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "role" = 'guest' WHERE "role" = 'super_admin'`,
    );
  }
}
