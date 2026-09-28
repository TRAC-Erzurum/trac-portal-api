import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateObservationPublishing1791100000000 implements MigrationInterface {
  name = 'CreateObservationPublishing1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const base = `
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "createdBy" varchar,
        "updatedBy" varchar[] NOT NULL DEFAULT '{}'`;

    await queryRunner.query(`
      CREATE TABLE "publish_targets" (${base},
        "name" varchar NOT NULL,
        "intakeUrl" varchar NOT NULL,
        "sourceId" varchar(100) NOT NULL,
        "sharedSecret" varchar NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "authFailedAt" timestamptz
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "disasters"
        ADD COLUMN "publishingEnabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN "publishTargetId" uuid,
        ADD CONSTRAINT "FK_disasters_publish_target" FOREIGN KEY ("publishTargetId")
          REFERENCES "publish_targets"("id") ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."publication_status_enum" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "publication_queue" (${base},
        "observationId" uuid NOT NULL,
        "disasterId" uuid NOT NULL,
        "targetId" uuid NOT NULL,
        "status" "public"."publication_status_enum" NOT NULL DEFAULT 'PENDING',
        "payload" jsonb NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "nextAttemptAt" timestamptz NOT NULL,
        "lastAttemptAt" timestamptz,
        "lastResult" varchar,
        "deliveredAt" timestamptz,
        CONSTRAINT "UQ_publication_queue_observation_target" UNIQUE ("observationId", "targetId"),
        CONSTRAINT "FK_publication_queue_observation" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_publication_queue_disaster" FOREIGN KEY ("disasterId") REFERENCES "disasters"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_publication_queue_target" FOREIGN KEY ("targetId") REFERENCES "publish_targets"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_publication_queue_status_next" ON "publication_queue" ("status", "nextAttemptAt");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_publication_queue_disaster_status" ON "publication_queue" ("disasterId", "status");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "publication_queue";`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."publication_status_enum";`,
    );
    await queryRunner.query(`
      ALTER TABLE "disasters"
        DROP CONSTRAINT IF EXISTS "FK_disasters_publish_target",
        DROP COLUMN IF EXISTS "publishTargetId",
        DROP COLUMN IF EXISTS "publishingEnabled";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "publish_targets";`);
  }
}
