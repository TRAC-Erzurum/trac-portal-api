import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrivacyAcceptedAtToUsers1773411748853 implements MigrationInterface {
  name = 'AddPrivacyAcceptedAtToUsers1773411748853';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "privacyAcceptedAt"
    `);
  }
}
