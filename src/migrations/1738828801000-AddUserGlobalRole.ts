import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGlobalRole1738828801000 implements MigrationInterface {
  name = 'AddUserGlobalRole1738828801000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."global_role_enum" AS ENUM('guest', 'super_admin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "globalRole" "public"."global_role_enum" NOT NULL DEFAULT 'guest'
    `);
    await queryRunner.query(`
      UPDATE "users" SET "globalRole" = 'super_admin' WHERE "role" = 'super_admin'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "globalRole"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."global_role_enum"`);
  }
}
