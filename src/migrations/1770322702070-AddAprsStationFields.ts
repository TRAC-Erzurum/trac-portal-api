import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAprsStationFields1770322702070 implements MigrationInterface {
  name = 'AddAprsStationFields1770322702070';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "aprsIsIgate" boolean DEFAULT false;
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "aprsIsDigipeater" boolean DEFAULT false;
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "aprsIgateMode" varchar NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "aprsDigipeaterType" varchar NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "aprsPath" varchar NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "aprsServer" varchar NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "aprsServer";`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "aprsPath";`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "aprsDigipeaterType";`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "aprsIgateMode";`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "aprsIsDigipeater";`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "aprsIsIgate";`,
    );
  }
}
