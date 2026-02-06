import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCityToBranchAndDistrictToInfra1738828803000 implements MigrationInterface {
  name = 'AddCityToBranchAndDistrictToInfra1738828803000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branches"
      ADD COLUMN IF NOT EXISTS "city" varchar NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure"
      ADD COLUMN IF NOT EXISTS "district" varchar NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure"
      DROP COLUMN IF EXISTS "district"
    `);
    await queryRunner.query(`
      ALTER TABLE "branches"
      DROP COLUMN IF EXISTS "city"
    `);
  }
}
