import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperatorBranchMemberships1775322905271 implements MigrationInterface {
  name = 'OperatorBranchMemberships1775322905271';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const orphanRows: { cnt: string }[] = await queryRunner.query(`
      SELECT COUNT(*)::text AS cnt
      FROM "user_branch_memberships" ubm
      INNER JOIN "users" u ON u."id" = ubm."userId"
      LEFT JOIN "operators" o ON o."userId" = u."id"
      WHERE o."id" IS NULL
    `);
    const orphanCount = parseInt(orphanRows[0]?.cnt ?? '0', 10);
    if (orphanCount > 0) {
      throw new Error(
        `Cannot migrate: ${orphanCount} user_branch_memberships row(s) have no linked operator (users without operator).`,
      );
    }

    await queryRunner.query(`
      CREATE TABLE "operator_branch_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "operatorId" uuid NOT NULL,
        "branchId" uuid NOT NULL,
        "role" "public"."branch_role_enum" NOT NULL,
        "status" "public"."membership_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying,
        "updatedBy" character varying array NOT NULL DEFAULT '{}',
        "processedBy" uuid,
        "processedAt" TIMESTAMP,
        "rejectionReason" character varying,
        CONSTRAINT "PK_operator_branch_memberships" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_operator_branch_memberships_operator_branch" UNIQUE ("operatorId", "branchId")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "operator_branch_memberships" (
        "id",
        "operatorId",
        "branchId",
        "role",
        "status",
        "createdAt",
        "updatedAt",
        "createdBy",
        "updatedBy",
        "processedBy",
        "processedAt",
        "rejectionReason"
      )
      SELECT
        ubm."id",
        o."id",
        ubm."branchId",
        ubm."role",
        ubm."status",
        ubm."createdAt",
        ubm."updatedAt",
        ubm."createdBy",
        ubm."updatedBy",
        ubm."processedBy",
        ubm."processedAt",
        ubm."rejectionReason"
      FROM "user_branch_memberships" ubm
      INNER JOIN "users" u ON u."id" = ubm."userId"
      INNER JOIN "operators" o ON o."userId" = u."id"
    `);

    await queryRunner.query(`
      ALTER TABLE "operator_branch_memberships"
      ADD CONSTRAINT "FK_operator_branch_memberships_operatorId"
      FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "operator_branch_memberships"
      ADD CONSTRAINT "FK_operator_branch_memberships_branchId"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_operator_branch_memberships_operatorId"
      ON "operator_branch_memberships" ("operatorId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_operator_branch_memberships_branchId"
      ON "operator_branch_memberships" ("branchId")
    `);

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
    await queryRunner.query(`DROP TABLE "user_branch_memberships"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_branch_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "branchId" uuid NOT NULL,
        "role" "public"."branch_role_enum" NOT NULL,
        "status" "public"."membership_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying,
        "updatedBy" character varying array NOT NULL DEFAULT '{}',
        "processedBy" uuid,
        "processedAt" TIMESTAMP,
        "rejectionReason" character varying,
        CONSTRAINT "PK_user_branch_memberships" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_branch_memberships_userId_branchId" UNIQUE ("userId", "branchId")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "user_branch_memberships" (
        "id",
        "userId",
        "branchId",
        "role",
        "status",
        "createdAt",
        "updatedAt",
        "createdBy",
        "updatedBy",
        "processedBy",
        "processedAt",
        "rejectionReason"
      )
      SELECT
        obm."id",
        o."userId",
        obm."branchId",
        obm."role",
        obm."status",
        obm."createdAt",
        obm."updatedAt",
        obm."createdBy",
        obm."updatedBy",
        obm."processedBy",
        obm."processedAt",
        obm."rejectionReason"
      FROM "operator_branch_memberships" obm
      INNER JOIN "operators" o ON o."id" = obm."operatorId"
      WHERE o."userId" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "user_branch_memberships"
      ADD CONSTRAINT "FK_user_branch_memberships_userId"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "user_branch_memberships"
      ADD CONSTRAINT "FK_user_branch_memberships_branchId"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_branch_memberships_userId" ON "user_branch_memberships" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_branch_memberships_branchId" ON "user_branch_memberships" ("branchId")
    `);

    await queryRunner.query(
      `ALTER TABLE "operator_branch_memberships" DROP CONSTRAINT "FK_operator_branch_memberships_branchId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "operator_branch_memberships" DROP CONSTRAINT "FK_operator_branch_memberships_operatorId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_operator_branch_memberships_branchId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_operator_branch_memberships_operatorId"`,
    );
    await queryRunner.query(`DROP TABLE "operator_branch_memberships"`);
  }
}
