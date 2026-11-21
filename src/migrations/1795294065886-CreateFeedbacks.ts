import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeedbacks1795294065886 implements MigrationInterface {
  name = 'CreateFeedbacks1795294065886';

  /**
   * Every feedback submission is saved before it is forwarded to GitHub.
   * `githubStatus` tracks forwarding: pending (not forwarded yet), sent,
   * failed (retried by the sync job) or skipped (security, never forwarded).
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feedbacks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "createdBy" varchar,
        "updatedBy" varchar[] NOT NULL DEFAULT '{}',
        "userId" uuid,
        "callSign" varchar,
        "category" varchar NOT NULL,
        "summary" varchar(120) NOT NULL,
        "body" text NOT NULL,
        "attachmentPaths" text[] NOT NULL DEFAULT '{}',
        "githubStatus" varchar NOT NULL DEFAULT 'pending',
        "githubAttempts" integer NOT NULL DEFAULT 0,
        "githubIssueNumber" integer,
        "githubIssueUrl" varchar,
        "githubError" varchar(500),
        CONSTRAINT "CHK_feedbacks_githubStatus" CHECK ("githubStatus" IN ('pending', 'sent', 'failed', 'skipped')),
        CONSTRAINT "FK_feedbacks_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_feedbacks_createdAt" ON "feedbacks" ("createdAt");`,
    );
  }

  /**
   * Drops the table and every feedback record in it. Reverting this migration
   * is irreversible for the stored feedback text.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_feedbacks_createdAt";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feedbacks";`);
  }
}
