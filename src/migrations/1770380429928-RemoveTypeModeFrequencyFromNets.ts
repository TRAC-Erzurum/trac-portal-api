import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTypeModeFrequencyFromNets1770380429928 implements MigrationInterface {
  name = 'RemoveTypeModeFrequencyFromNets1770380429928';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "nets" DROP COLUMN IF EXISTS "type"`);
    await queryRunner.query(`ALTER TABLE "nets" DROP COLUMN IF EXISTS "mode"`);
    await queryRunner.query(
      `ALTER TABLE "nets" DROP COLUMN IF EXISTS "frequency"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nets" ADD COLUMN "frequency" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" ADD COLUMN "mode" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" ADD COLUMN "type" character varying NOT NULL`,
    );
  }
}
