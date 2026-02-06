import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserBranchMembershipTable1770237900000 implements MigrationInterface {
  name = 'CreateUserBranchMembershipTable1770237900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."branch_role_enum" AS ENUM('admin', 'member', 'volunteer');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."membership_status_enum" AS ENUM('pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_branch_memberships" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
        "branchId" uuid NOT NULL REFERENCES "branches"(id) ON DELETE CASCADE,
        "role" "public"."branch_role_enum" NOT NULL,
        "status" "public"."membership_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}',
        CONSTRAINT "UQ_user_branch_memberships_userId_branchId" UNIQUE ("userId", "branchId")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_branch_memberships_userId" 
      ON "user_branch_memberships" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_branch_memberships_branchId" 
      ON "user_branch_memberships" ("branchId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_branch_memberships_branchId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_branch_memberships_userId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_branch_memberships"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."membership_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."branch_role_enum"`);
  }
}
