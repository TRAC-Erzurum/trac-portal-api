import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDmrIdToOperators1770663559335 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "operators"
      ADD COLUMN "dmrId" integer NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "operators"
      ADD CONSTRAINT "UQ_operators_dmrId" UNIQUE ("dmrId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "operators"
      DROP CONSTRAINT "UQ_operators_dmrId"
    `);

    await queryRunner.query(`
      ALTER TABLE "operators"
      DROP COLUMN "dmrId"
    `);
  }
}
