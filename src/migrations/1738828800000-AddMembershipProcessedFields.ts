import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMembershipProcessedFields1738828800000
  implements MigrationInterface
{
  name = 'AddMembershipProcessedFields1738828800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_branch_memberships"
      ADD COLUMN IF NOT EXISTS "processedBy" uuid NULL,
      ADD COLUMN IF NOT EXISTS "processedAt" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "rejectionReason" varchar NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_branch_memberships"
      DROP COLUMN IF EXISTS "rejectionReason",
      DROP COLUMN IF EXISTS "processedAt",
      DROP COLUMN IF EXISTS "processedBy"
    `);
  }
}
