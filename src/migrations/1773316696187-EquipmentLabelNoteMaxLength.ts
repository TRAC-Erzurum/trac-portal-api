import { MigrationInterface, QueryRunner } from 'typeorm';

export class EquipmentLabelNoteMaxLength1773316696187 implements MigrationInterface {
  name = 'EquipmentLabelNoteMaxLength1773316696187';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "equipment"
      ALTER COLUMN "label" TYPE character varying(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment"
      ALTER COLUMN "note" TYPE character varying(1000)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "equipment"
      ALTER COLUMN "label" TYPE character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment"
      ALTER COLUMN "note" TYPE text
    `);
  }
}
