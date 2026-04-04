import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOperatorBranchPreMemberships1775289376227 implements MigrationInterface {
  name = 'CreateOperatorBranchPreMemberships1775289376227';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "operator_branch_pre_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying,
        "updatedBy" character varying[] NOT NULL DEFAULT '{}',
        "callSign" character varying NOT NULL,
        "branchId" uuid NOT NULL,
        "role" "public"."branch_role_enum" NOT NULL,
        CONSTRAINT "UQ_operator_branch_pre_memberships_callSign_branchId" UNIQUE ("callSign", "branchId"),
        CONSTRAINT "PK_operator_branch_pre_memberships" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_operator_branch_pre_memberships_callSign"
        ON "operator_branch_pre_memberships" ("callSign")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_operator_branch_pre_memberships_branchId"
        ON "operator_branch_pre_memberships" ("branchId")
    `);

    await queryRunner.query(`
      ALTER TABLE "operator_branch_pre_memberships"
        ADD CONSTRAINT "FK_operator_branch_pre_memberships_branch"
        FOREIGN KEY ("branchId")
        REFERENCES "branches"("id")
        ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "operator_branch_pre_memberships" DROP CONSTRAINT "FK_operator_branch_pre_memberships_branch"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_operator_branch_pre_memberships_branchId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_operator_branch_pre_memberships_callSign"`,
    );
    await queryRunner.query(`DROP TABLE "operator_branch_pre_memberships"`);
  }
}
