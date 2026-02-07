import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommunicationChannelsAndTutorials1770425152782
  implements MigrationInterface
{
  name = 'CreateCommunicationChannelsAndTutorials1770425152782';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."communication_channel_type_enum" AS ENUM('vhf_uhf_repeater', 'echolink', 'aprs', 'hf');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "branch_communication_channels" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "branchId" uuid NOT NULL,
        "type" "public"."communication_channel_type_enum" NOT NULL,
        "name" varchar NOT NULL,
        "description" text NULL,
        "isActive" boolean DEFAULT true,
        "repeaterMode" varchar NULL,
        "location" varchar NULL,
        "district" varchar NULL,
        "latitude" decimal(10, 7) NULL,
        "longitude" decimal(10, 7) NULL,
        "altitude" int NULL,
        "coverage" varchar NULL,
        "rxFrequency" decimal(10, 4) NULL,
        "txFrequency" decimal(10, 4) NULL,
        "offset" varchar NULL,
        "txCtcssTone" decimal(5, 1) NULL,
        "rxCtcssTone" decimal(5, 1) NULL,
        "txDcsCode" varchar NULL,
        "txDcsPolarity" varchar(1) NULL,
        "rxDcsCode" varchar NULL,
        "rxDcsPolarity" varchar(1) NULL,
        "echolinkNode" varchar NULL,
        "echolinkName" varchar NULL,
        "aprsFrequency" decimal(10, 4) NULL,
        "aprsIsIgate" boolean DEFAULT false,
        "aprsIsDigipeater" boolean DEFAULT false,
        "aprsIgateMode" varchar NULL,
        "aprsDigipeaterType" varchar NULL,
        "aprsPath" varchar NULL,
        "aprsServer" varchar NULL,
        "digipeater" varchar NULL,
        "hfFrequencyRange" varchar NULL,
        "hfMode" varchar NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "branch_communication_channels"
      ADD CONSTRAINT "FK_branch_communication_channels_branchId"
      FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_branch_communication_channels_branchId" ON "branch_communication_channels" ("branchId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_branch_communication_channels_type" ON "branch_communication_channels" ("type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_branch_communication_channels_isActive" ON "branch_communication_channels" ("isActive");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "communication_channel_tutorials" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" "public"."communication_channel_type_enum" NOT NULL,
        "title" varchar NOT NULL,
        "content" text NOT NULL,
        "locale" varchar(5) NOT NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_communication_channel_tutorials_type_locale"
      ON "communication_channel_tutorials" ("type", "locale");
    `);

    const types = ['vhf_uhf_repeater', 'echolink', 'aprs', 'hf'] as const;
    const locales = ['tr', 'en'] as const;
    for (const type of types) {
      for (const locale of locales) {
        const title =
          type === 'vhf_uhf_repeater'
            ? locale === 'tr'
              ? 'VHF/UHF Röle'
              : 'VHF/UHF Repeater'
            : type;
        await queryRunner.query(
          `INSERT INTO communication_channel_tutorials (id, type, title, content, locale)
           SELECT uuid_generate_v4(), $1, $2, 'Content to be updated.', $3::varchar(5)
           WHERE NOT EXISTS (SELECT 1 FROM communication_channel_tutorials WHERE type = $1 AND locale = $3::varchar(5))`,
          [type, title, locale],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_communication_channel_tutorials_type_locale"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "communication_channel_tutorials"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_communication_channels" DROP CONSTRAINT IF EXISTS "FK_branch_communication_channels_branchId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_branch_communication_channels_isActive"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_branch_communication_channels_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_branch_communication_channels_branchId"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "branch_communication_channels"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."communication_channel_type_enum"`,
    );
  }
}
