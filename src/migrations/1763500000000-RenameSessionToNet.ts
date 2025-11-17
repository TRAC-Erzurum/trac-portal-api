import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameSessionToNet1763500000000 implements MigrationInterface {
  name = 'RenameSessionToNet1763500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendees" 
      DROP CONSTRAINT IF EXISTS "FK_9745dcd0e4dfb72736a9b7256a0"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions" 
      DROP CONSTRAINT IF EXISTS "FK_bdf1439751d968cf98766746bae"
    `);

    await queryRunner.query(`
      ALTER TABLE "attendees" 
      RENAME COLUMN "sessionId" TO "netId"
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."sessions_mode_enum" 
      RENAME TO "nets_mode_enum"
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."sessions_type_enum" 
      RENAME TO "nets_type_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions" 
      RENAME TO "nets"
    `);

    await queryRunner.query(`
      ALTER TABLE "attendees" 
      ADD CONSTRAINT "FK_9745dcd0e4dfb72736a9b7256a0" 
      FOREIGN KEY ("netId") 
      REFERENCES "nets"("id") 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "nets" 
      ADD CONSTRAINT "FK_bdf1439751d968cf98766746bae" 
      FOREIGN KEY ("operatorId") 
      REFERENCES "operators"("id") 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendees" 
      DROP CONSTRAINT IF EXISTS "FK_9745dcd0e4dfb72736a9b7256a0"
    `);

    await queryRunner.query(`
      ALTER TABLE "nets" 
      DROP CONSTRAINT IF EXISTS "FK_bdf1439751d968cf98766746bae"
    `);

    await queryRunner.query(`
      ALTER TABLE "attendees" 
      RENAME COLUMN "netId" TO "sessionId"
    `);

    await queryRunner.query(`
      ALTER TABLE "nets" 
      RENAME TO "sessions"
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."nets_mode_enum" 
      RENAME TO "sessions_mode_enum"
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."nets_type_enum" 
      RENAME TO "sessions_type_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "attendees" 
      ADD CONSTRAINT "FK_9745dcd0e4dfb72736a9b7256a0" 
      FOREIGN KEY ("sessionId") 
      REFERENCES "sessions"("id") 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions" 
      ADD CONSTRAINT "FK_bdf1439751d968cf98766746bae" 
      FOREIGN KEY ("operatorId") 
      REFERENCES "operators"("id") 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);
  }
}

