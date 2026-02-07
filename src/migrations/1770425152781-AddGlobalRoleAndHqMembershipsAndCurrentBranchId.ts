import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGlobalRoleAndHqMembershipsAndCurrentBranchId1770425152781
  implements MigrationInterface
{
  name = 'AddGlobalRoleAndHqMembershipsAndCurrentBranchId1770425152781';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."global_role_enum" AS ENUM('guest', 'super_admin');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "globalRole" "public"."global_role_enum" NOT NULL DEFAULT 'guest';
    `);
    await queryRunner.query(`
      UPDATE "users" SET "globalRole" = 'super_admin' WHERE "role" = 'super_admin';
    `);

    const hqRow = await queryRunner.query(
      `SELECT id FROM branches WHERE "isHeadquarters" = true LIMIT 1`,
    );
    const hqId = hqRow?.[0]?.id;
    if (!hqId) {
      return;
    }

    await queryRunner.query(
      `INSERT INTO user_branch_memberships (id, "userId", "branchId", role, status, "createdAt", "updatedAt", "createdBy", "updatedBy")
       SELECT uuid_generate_v4(), u.id, $1, 'admin', 'approved', now(), now(), u.email, '{}'
       FROM users u WHERE u."globalRole" = 'super_admin' AND NOT EXISTS (
         SELECT 1 FROM user_branch_memberships m WHERE m."userId" = u.id AND m."branchId" = $1
       )`,
      [hqId],
    );
    await queryRunner.query(
      `INSERT INTO user_branch_memberships ("userId", "branchId", role, status, "createdAt", "updatedAt", "createdBy", "updatedBy")
       SELECT u.id, $1, 'volunteer', 'approved', NOW(), NOW(), u.email, '{}'
       FROM users u WHERE u.role != 'guest'
       AND NOT EXISTS (SELECT 1 FROM user_branch_memberships ubm WHERE ubm."userId" = u.id AND ubm."branchId" = $1)`,
      [hqId],
    );

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "currentBranchId" uuid NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_currentBranchId"
      FOREIGN KEY ("currentBranchId") REFERENCES "public"."branches"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_currentBranchId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "currentBranchId"`,
    );
    const hqRow = await queryRunner.query(
      `SELECT id FROM branches WHERE "isHeadquarters" = true LIMIT 1`,
    );
    const hqId = hqRow?.[0]?.id;
    if (hqId) {
      await queryRunner.query(
        `DELETE FROM user_branch_memberships WHERE "branchId" = $1`,
        [hqId],
      );
    }
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "globalRole"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."global_role_enum"`);
  }
}
