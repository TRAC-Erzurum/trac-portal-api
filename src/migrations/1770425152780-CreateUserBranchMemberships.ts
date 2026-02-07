import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserBranchMemberships1770425152780
  implements MigrationInterface
{
  name = 'CreateUserBranchMemberships1770425152780';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."branch_role_enum" AS ENUM('admin', 'member', 'volunteer');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."membership_status_enum" AS ENUM('pending', 'approved', 'rejected');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_branch_memberships" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "branchId" uuid NOT NULL,
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
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE c.contype = 'p' AND t.relname = 'users'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id");
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "user_branch_memberships"
      ADD CONSTRAINT "FK_user_branch_memberships_userId"
      FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE "user_branch_memberships"
      ADD CONSTRAINT "FK_user_branch_memberships_branchId"
      FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_branch_memberships_userId" ON "user_branch_memberships" ("userId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_branch_memberships_branchId" ON "user_branch_memberships" ("branchId");
    `);
    await queryRunner.query(
      `ALTER TABLE "user_branch_memberships" ADD COLUMN IF NOT EXISTS "processedBy" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_branch_memberships" ADD COLUMN IF NOT EXISTS "processedAt" timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_branch_memberships" ADD COLUMN IF NOT EXISTS "rejectionReason" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_branch_memberships" DROP COLUMN IF EXISTS "rejectionReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_branch_memberships" DROP COLUMN IF EXISTS "processedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_branch_memberships" DROP COLUMN IF EXISTS "processedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_branch_memberships" DROP CONSTRAINT IF EXISTS "FK_user_branch_memberships_branchId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_branch_memberships" DROP CONSTRAINT IF EXISTS "FK_user_branch_memberships_userId"`,
    );
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
