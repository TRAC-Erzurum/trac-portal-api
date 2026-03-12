import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuantityToEquipment1773310700763 implements MigrationInterface {
  name = 'AddQuantityToEquipment1773310700763';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "equipment"
      ADD COLUMN IF NOT EXISTS "quantity" integer NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "equipment"
      DROP COLUMN IF EXISTS "quantity"
    `);
  }
}
