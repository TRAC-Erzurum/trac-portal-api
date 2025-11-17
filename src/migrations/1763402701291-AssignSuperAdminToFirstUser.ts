import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssignSuperAdminToFirstUser1763402701291 implements MigrationInterface {
  name = 'AssignSuperAdminToFirstUser1763402701291';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      `UPDATE "users" SET "role" = 'guest' WHERE "role" = 'super_admin'`,
    );
  }
}
