import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserRoleVarcharEffectiveRole1774980435347
  implements MigrationInterface
{
  name = 'UserRoleVarcharEffectiveRole1774980435347';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role_new" character varying(32)`,
    );
    await queryRunner.query(`
      UPDATE "users" u SET "role_new" = CASE
        WHEN u."globalRole" = 'super_admin' THEN 'super_admin'
        WHEN EXISTS (
          SELECT 1 FROM "user_branch_memberships" m
          WHERE m."userId" = u.id AND m.status = 'approved' AND m.role = 'president'
        ) THEN 'president'
        WHEN EXISTS (
          SELECT 1 FROM "user_branch_memberships" m
          WHERE m."userId" = u.id AND m.status = 'approved' AND m.role = 'admin'
        ) THEN 'admin'
        WHEN EXISTS (
          SELECT 1 FROM "user_branch_memberships" m
          WHERE m."userId" = u.id AND m.status = 'approved' AND m.role = 'member'
        ) THEN 'member'
        WHEN EXISTS (
          SELECT 1 FROM "user_branch_memberships" m
          WHERE m."userId" = u.id AND m.status = 'approved' AND m.role = 'volunteer'
        ) THEN 'volunteer'
        ELSE 'guest'
      END
    `);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "role_new" TO "role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'guest'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "role_enum" "public"."users_role_enum" NOT NULL DEFAULT 'guest'`,
    );
    await queryRunner.query(`
      UPDATE "users" SET "role_enum" = (
        CASE
          WHEN "role" = 'super_admin' THEN 'super_admin'
          WHEN "role" IN ('president', 'admin') THEN 'admin'
          WHEN "role" = 'member' THEN 'member'
          WHEN "role" = 'volunteer' THEN 'volunteer'
          ELSE 'guest'
        END
      )::"public"."users_role_enum"
    `);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "role_enum" TO "role"`,
    );
  }
}
