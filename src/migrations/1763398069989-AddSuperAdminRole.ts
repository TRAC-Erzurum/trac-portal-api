import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminRole1763398069989 implements MigrationInterface {
  name = 'AddSuperAdminRole1763398069989';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'super_admin'`,
    );

    const superAdminCount = await queryRunner.query(
      `SELECT COUNT(*)::int as count FROM "users" WHERE "role" = 'super_admin'`,
    );

    if (parseInt(superAdminCount[0]?.count || '0', 10) === 0) {
      const firstUser = await queryRunner.query(
        `SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1`,
      );

      if (firstUser?.length > 0) {
        await queryRunner.query(
          `UPDATE "users" SET "role" = 'super_admin' WHERE "id" = $1`,
          [firstUser[0].id],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "users" WHERE "role" = 'super_admin'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" DROP VALUE IF EXISTS 'super_admin'`,
    );
  }
}
