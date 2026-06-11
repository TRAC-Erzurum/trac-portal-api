import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupGlobalRolesAndAddPresidentRole1770425152784 implements MigrationInterface {
  name = 'CleanupGlobalRolesAndAddPresidentRole1770425152784';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users SET role = 'guest', "globalRole" = 'guest'
      WHERE role IN ('member', 'volunteer', 'admin') AND "globalRole" != 'super_admin';
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."branch_role_enum" ADD VALUE 'president';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Cannot reliably reverse cleanup; cannot remove enum value in PostgreSQL
  }
}
