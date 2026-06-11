import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNetsBranchFieldsAndNetCommunicationChannels1770425152783 implements MigrationInterface {
  name = 'AddNetsBranchFieldsAndNetCommunicationChannels1770425152783';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "nets" DROP COLUMN IF EXISTS "type"`);
    await queryRunner.query(`ALTER TABLE "nets" DROP COLUMN IF EXISTS "mode"`);
    await queryRunner.query(
      `ALTER TABLE "nets" DROP COLUMN IF EXISTS "frequency"`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "net_communication_channels" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "netId" uuid NOT NULL,
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
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE c.contype = 'p' AND t.relname = 'nets'
        ) THEN
          ALTER TABLE "nets" ADD CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id");
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "net_communication_channels"
      ADD CONSTRAINT "FK_net_communication_channels_netId"
      FOREIGN KEY ("netId") REFERENCES "public"."nets"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE "net_communication_channels"
      ADD CONSTRAINT "FK_net_communication_channels_communicationChannelId"
      FOREIGN KEY ("communicationChannelId") REFERENCES "public"."branch_communication_channels"("id") ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_communication_channels_netId" ON "net_communication_channels" ("netId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_communication_channels_communicationChannelId" ON "net_communication_channels" ("communicationChannelId");
    `);

    const netsRows = await queryRunner.query(`SELECT id FROM nets`);
    const existing = await queryRunner.query(
      `SELECT "netId" FROM net_communication_channels`,
    );
    const existingIds = new Set(
      (existing || []).map((r: { netId: string }) => r.netId),
    );
    for (const row of netsRows || []) {
      if (!existingIds.has(row.id)) {
        await queryRunner.query(
          `INSERT INTO net_communication_channels (id, "netId", "communicationChannelId", "isSimplexAdHoc", "simplexFrequency", "createdAt", "updatedAt", "createdBy", "updatedBy")
           VALUES (uuid_generate_v4(), $1, NULL, true, '433.500', NOW(), NOW(), NULL, '{}')`,
          [row.id],
        );
      }
    }

    await queryRunner.query(
      `ALTER TABLE "nets" ADD COLUMN IF NOT EXISTS "branchId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" ADD COLUMN IF NOT EXISTS "branchCallSignId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true`,
    );

    const hqRow = await queryRunner.query(
      `SELECT id FROM branches WHERE "isHeadquarters" = true LIMIT 1`,
    );
    const hqId = hqRow?.[0]?.id;
    if (!hqId) {
      throw new Error('HQ branch must exist when migrating nets');
    }
    const hqCallSign = await queryRunner.query(
      `SELECT id FROM branch_call_signs WHERE "branchId" = $1 AND "isDefault" = true LIMIT 1`,
      [hqId],
    );
    const hqCallSignId = hqCallSign?.[0]?.id ?? null;
    await queryRunner.query(
      `UPDATE nets SET "branchId" = $1, "branchCallSignId" = $2, "isActive" = true WHERE "branchId" IS NULL`,
      [hqId, hqCallSignId],
    );

    await queryRunner.query(
      `ALTER TABLE "nets" ALTER COLUMN "branchId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" DROP CONSTRAINT IF EXISTS "FK_nets_branchId"`,
    );
    await queryRunner.query(`
      ALTER TABLE "nets" ADD CONSTRAINT "FK_nets_branchId" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;
    `);
    await queryRunner.query(
      `ALTER TABLE "nets" DROP CONSTRAINT IF EXISTS "FK_nets_branchCallSignId"`,
    );
    await queryRunner.query(`
      ALTER TABLE "nets" ADD CONSTRAINT "FK_nets_branchCallSignId" FOREIGN KEY ("branchCallSignId") REFERENCES "public"."branch_call_signs"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nets" DROP CONSTRAINT IF EXISTS "FK_nets_branchCallSignId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" DROP CONSTRAINT IF EXISTS "FK_nets_branchId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" DROP COLUMN IF EXISTS "isActive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" DROP COLUMN IF EXISTS "branchCallSignId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" DROP COLUMN IF EXISTS "branchId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "net_communication_channels" DROP CONSTRAINT IF EXISTS "FK_net_communication_channels_communicationChannelId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "net_communication_channels" DROP CONSTRAINT IF EXISTS "FK_net_communication_channels_netId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_net_communication_channels_communicationChannelId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_net_communication_channels_netId"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "net_communication_channels"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" ADD COLUMN "frequency" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" ADD COLUMN "mode" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "nets" ADD COLUMN "type" character varying`,
    );
  }
}
