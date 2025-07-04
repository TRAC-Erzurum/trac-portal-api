import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatedByUpdatedByToAllEntities1748287556000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add to users table
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "createdBy" character varying,
      ADD COLUMN IF NOT EXISTS "updatedBy" character varying[] DEFAULT '{}'
    `);

    // Add to operators table
    await queryRunner.query(`
      ALTER TABLE "operators"
      ADD COLUMN IF NOT EXISTS "createdBy" character varying,
      ADD COLUMN IF NOT EXISTS "updatedBy" character varying[] DEFAULT '{}'
    `);

    // Add to sessions table
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "createdBy" character varying,
      ADD COLUMN IF NOT EXISTS "updatedBy" character varying[] DEFAULT '{}'
    `);

    // Add to attendees table
    await queryRunner.query(`
      ALTER TABLE "attendees"
      ADD COLUMN IF NOT EXISTS "createdBy" character varying,
      ADD COLUMN IF NOT EXISTS "updatedBy" character varying[] DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove from users table
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "createdBy",
      DROP COLUMN IF EXISTS "updatedBy"
    `);

    // Remove from operators table
    await queryRunner.query(`
      ALTER TABLE "operators"
      DROP COLUMN IF EXISTS "createdBy",
      DROP COLUMN IF EXISTS "updatedBy"
    `);

    // Remove from sessions table
    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP COLUMN IF EXISTS "createdBy",
      DROP COLUMN IF EXISTS "updatedBy"
    `);

    // Remove from attendees table
    await queryRunner.query(`
      ALTER TABLE "attendees"
      DROP COLUMN IF EXISTS "createdBy",
      DROP COLUMN IF EXISTS "updatedBy"
    `);
  }
}
