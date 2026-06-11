import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendeesNetIdOnDeleteCascade1775051711368 implements MigrationInterface {
  name = 'AttendeesNetIdOnDeleteCascade1775051711368';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendees"
      DROP CONSTRAINT IF EXISTS "FK_9745dcd0e4dfb72736a9b7256a0"
    `);
    await queryRunner.query(`
      ALTER TABLE "attendees"
      ADD CONSTRAINT "FK_9745dcd0e4dfb72736a9b7256a0"
      FOREIGN KEY ("netId")
      REFERENCES "nets"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendees"
      DROP CONSTRAINT IF EXISTS "FK_9745dcd0e4dfb72736a9b7256a0"
    `);
    await queryRunner.query(`
      ALTER TABLE "attendees"
      ADD CONSTRAINT "FK_9745dcd0e4dfb72736a9b7256a0"
      FOREIGN KEY ("netId")
      REFERENCES "nets"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);
  }
}
