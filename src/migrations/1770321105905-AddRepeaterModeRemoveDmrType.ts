import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRepeaterModeRemoveDmrType1770321105905 implements MigrationInterface {
  name = 'AddRepeaterModeRemoveDmrType1770321105905';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" 
      ADD COLUMN IF NOT EXISTS "repeaterMode" varchar NULL;
    `);

    await queryRunner.query(`
      UPDATE "branch_infrastructure" 
      SET "repeaterMode" = 'digital'
      WHERE "type" = 'dmr';
    `);

    await queryRunner.query(`
      UPDATE "branch_infrastructure" 
      SET "type" = 'vhf_uhf_repeater'
      WHERE "type" = 'dmr';
    `);

    await queryRunner.query(`
      UPDATE "branch_infrastructure" 
      SET "repeaterMode" = 'analog'
      WHERE "type" = 'vhf_uhf_repeater' AND "repeaterMode" IS NULL;
    `);

    await queryRunner.query(`
      DELETE FROM "infrastructure_tutorials"
      WHERE "type" = 'dmr';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "branch_infrastructure" 
      SET "type" = 'dmr'
      WHERE "type" = 'vhf_uhf_repeater' AND "repeaterMode" = 'digital';
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "repeaterMode";
    `);
  }
}
