import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNetSchedulerAndNetFields1771411001716
  implements MigrationInterface
{
  name = 'AddNetSchedulerAndNetFields1771411001716';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add columns to nets
    await queryRunner.query(`
      ALTER TABLE "nets" ADD COLUMN IF NOT EXISTS "scheduledAt" timestamptz NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "nets" ADD COLUMN IF NOT EXISTS "estimatedDurationMinutes" integer DEFAULT 30
    `);
    await queryRunner.query(`
      ALTER TABLE "nets" ADD COLUMN IF NOT EXISTS "totalDurationMinutes" integer DEFAULT 0
    `);

    // 2. Create net_recurrence_enum and net_schedulers table (scheduler_id FK added after)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."net_recurrence_enum" AS ENUM('one_time', 'daily', 'weekly', 'monthly');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "net_schedulers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "branchId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "operatorId" uuid NOT NULL,
        "branchCallSignId" uuid NULL,
        "startDate" date NOT NULL,
        "recurrence" "public"."net_recurrence_enum" NOT NULL,
        "endDate" date NULL,
        "scheduledTime" time NOT NULL DEFAULT '20:00:00',
        "estimatedDurationMinutes" integer NOT NULL DEFAULT 30,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "net_schedulers"
      ADD CONSTRAINT "FK_net_schedulers_branchId"
      FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "net_schedulers"
      ADD CONSTRAINT "FK_net_schedulers_operatorId"
      FOREIGN KEY ("operatorId") REFERENCES "public"."operators"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "net_schedulers"
      ADD CONSTRAINT "FK_net_schedulers_branchCallSignId"
      FOREIGN KEY ("branchCallSignId") REFERENCES "public"."branch_call_signs"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_schedulers_branchId" ON "net_schedulers" ("branchId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_schedulers_operatorId" ON "net_schedulers" ("operatorId")
    `);

    // 3. Add scheduler_id to nets (ON DELETE SET NULL)
    await queryRunner.query(`
      ALTER TABLE "nets" ADD COLUMN IF NOT EXISTS "schedulerId" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "nets"
      ADD CONSTRAINT "FK_nets_schedulerId"
      FOREIGN KEY ("schedulerId") REFERENCES "public"."net_schedulers"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nets_schedulerId" ON "nets" ("schedulerId")
    `);

    // 4. net_scheduler_communication_channels junction
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "net_scheduler_communication_channels" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "schedulerId" uuid NOT NULL,
        "communicationChannelId" uuid NULL,
        "isSimplexAdHoc" boolean DEFAULT false,
        "simplexFrequency" varchar NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "net_scheduler_communication_channels"
      ADD CONSTRAINT "FK_net_scheduler_communication_channels_schedulerId"
      FOREIGN KEY ("schedulerId") REFERENCES "public"."net_schedulers"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "net_scheduler_communication_channels"
      ADD CONSTRAINT "FK_net_scheduler_communication_channels_communicationChannelId"
      FOREIGN KEY ("communicationChannelId") REFERENCES "public"."branch_communication_channels"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_scheduler_communication_channels_schedulerId" ON "net_scheduler_communication_channels" ("schedulerId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_scheduler_communication_channels_communicationChannelId" ON "net_scheduler_communication_channels" ("communicationChannelId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_net_scheduler_communication_channels_communicationChannelId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_net_scheduler_communication_channels_schedulerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "net_scheduler_communication_channels" DROP CONSTRAINT IF EXISTS "FK_net_scheduler_communication_channels_communicationChannelId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "net_scheduler_communication_channels" DROP CONSTRAINT IF EXISTS "FK_net_scheduler_communication_channels_schedulerId"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "net_scheduler_communication_channels"`,
    );

    await queryRunner.query(
      `ALTER TABLE "nets" DROP CONSTRAINT IF EXISTS "FK_nets_schedulerId"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_nets_schedulerId"`);
    await queryRunner.query(
      `ALTER TABLE "nets" DROP COLUMN IF EXISTS "schedulerId"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_net_schedulers_operatorId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_net_schedulers_branchId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "net_schedulers" DROP CONSTRAINT IF EXISTS "FK_net_schedulers_branchCallSignId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "net_schedulers" DROP CONSTRAINT IF EXISTS "FK_net_schedulers_operatorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "net_schedulers" DROP CONSTRAINT IF EXISTS "FK_net_schedulers_branchId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "net_schedulers"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."net_recurrence_enum"`);

    await queryRunner.query(
      `ALTER TABLE "nets" DROP COLUMN IF EXISTS "totalDurationMinutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" DROP COLUMN IF EXISTS "estimatedDurationMinutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" DROP COLUMN IF EXISTS "scheduledAt"`,
    );
  }
}
