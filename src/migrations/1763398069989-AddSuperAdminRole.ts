import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminRole1763398069989 implements MigrationInterface {
  name = 'AddSuperAdminRole1763398069989';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'super_admin'`,
    );
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
