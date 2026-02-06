import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInfrastructureTables1770319558345 implements MigrationInterface {
  name = 'CreateInfrastructureTables1770319558345';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."infrastructure_type_enum" AS ENUM('vhf_uhf_repeater', 'dmr', 'echolink', 'aprs', 'hf');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "branch_infrastructure" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "branchId" uuid NOT NULL REFERENCES "branches"(id) ON DELETE CASCADE,
        "type" "public"."infrastructure_type_enum" NOT NULL,
        "name" varchar NOT NULL,
        "description" text NULL,
        "isActive" boolean DEFAULT true,
        
        "location" varchar NULL,
        "latitude" decimal(10, 7) NULL,
        "longitude" decimal(10, 7) NULL,
        "altitude" int NULL,
        "coverage" varchar NULL,
        
        "rxFrequency" decimal(10, 4) NULL,
        "txFrequency" decimal(10, 4) NULL,
        "offset" varchar NULL,
        "ctcssTone" decimal(5, 1) NULL,
        "dcsTone" varchar NULL,
        
        "dmrId" varchar NULL,
        "talkgroup" varchar NULL,
        "colorCode" int NULL,
        "timeSlot" int NULL,
        
        "echolinkNode" varchar NULL,
        "echolinkName" varchar NULL,
        
        "aprsFrequency" decimal(10, 4) NULL,
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
      CREATE INDEX IF NOT EXISTS "IDX_branch_infrastructure_branchId" 
      ON "branch_infrastructure" ("branchId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_branch_infrastructure_type" 
      ON "branch_infrastructure" ("type");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_branch_infrastructure_isActive" 
      ON "branch_infrastructure" ("isActive");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "infrastructure_tutorials" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" "public"."infrastructure_type_enum" NOT NULL,
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
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_infrastructure_tutorials_type_locale" 
      ON "infrastructure_tutorials" ("type", "locale");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_infrastructure_tutorials_type_locale"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "infrastructure_tutorials"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_branch_infrastructure_isActive"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_branch_infrastructure_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_branch_infrastructure_branchId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "branch_infrastructure"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."infrastructure_type_enum"`,
    );
  }
}
