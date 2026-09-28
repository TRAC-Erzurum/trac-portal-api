import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSessionsValidAfter1791000000000 implements MigrationInterface {
  name = 'AddUserSessionsValidAfter1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sessionsValidAfter" timestamp NULL`,
    );
    // An empty Google id is no Google identity (complete-sso-registration
    // stored '' when the session had lost it); make it NULL like the rest.
    await queryRunner.query(
      `UPDATE "users" SET "providerId" = NULL WHERE "providerId" = ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "sessionsValidAfter"`,
    );
  }
}
