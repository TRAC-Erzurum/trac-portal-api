import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateInfrastructureToneFields1770320660902 implements MigrationInterface {
  name = 'UpdateInfrastructureToneFields1770320660902';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "txCtcssTone" decimal(5, 1) NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "rxCtcssTone" decimal(5, 1) NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "txDcsCode" varchar NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "txDcsPolarity" varchar(1) NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "rxDcsCode" varchar NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "rxDcsPolarity" varchar(1) NULL;
    `);

    await queryRunner.query(`
      UPDATE "branch_infrastructure" 
      SET "txCtcssTone" = "ctcssTone", "rxCtcssTone" = "ctcssTone"
      WHERE "ctcssTone" IS NOT NULL;
    `);

    await queryRunner.query(`
      UPDATE "branch_infrastructure" 
      SET 
        "txDcsCode" = SUBSTRING("dcsTone" FROM 2 FOR 3),
        "txDcsPolarity" = SUBSTRING("dcsTone" FROM 5 FOR 1),
        "rxDcsCode" = SUBSTRING("dcsTone" FROM 2 FOR 3),
        "rxDcsPolarity" = SUBSTRING("dcsTone" FROM 5 FOR 1)
      WHERE "dcsTone" IS NOT NULL AND "dcsTone" LIKE 'D___N' OR "dcsTone" LIKE 'D___I';
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "ctcssTone";
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "dcsTone";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "ctcssTone" decimal(5, 1) NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "dcsTone" varchar NULL;
    `);

    await queryRunner.query(`
      UPDATE "branch_infrastructure" 
      SET "ctcssTone" = "txCtcssTone"
      WHERE "txCtcssTone" IS NOT NULL;
    `);

    await queryRunner.query(`
      UPDATE "branch_infrastructure" 
      SET "dcsTone" = 'D' || "txDcsCode" || "txDcsPolarity"
      WHERE "txDcsCode" IS NOT NULL;
    `);

    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "txCtcssTone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "rxCtcssTone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "txDcsCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "txDcsPolarity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "rxDcsCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "rxDcsPolarity"`,
    );
  }
}
