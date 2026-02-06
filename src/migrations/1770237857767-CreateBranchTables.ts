import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBranchTables1770237857767 implements MigrationInterface {
  name = 'CreateBranchTables1770237857767';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."branch_type_enum" AS ENUM('branch', 'representative');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "branches" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar UNIQUE NOT NULL,
        "type" "public"."branch_type_enum" NOT NULL,
        "isHeadquarters" boolean DEFAULT false,
        "isActive" boolean DEFAULT true,
        "address" varchar NULL,
        "phone" varchar NULL,
        "email" varchar NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "branch_call_signs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "branchId" uuid NOT NULL REFERENCES "branches"(id) ON DELETE CASCADE,
        "callSign" varchar UNIQUE NOT NULL,
        "isDefault" boolean DEFAULT false,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_branch_call_signs_default" 
      ON "branch_call_signs" ("branchId") 
      WHERE "isDefault" = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_branch_call_signs_default"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "branch_call_signs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "branches"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."branch_type_enum"`);
  }
}
