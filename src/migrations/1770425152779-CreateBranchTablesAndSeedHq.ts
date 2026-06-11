import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBranchTablesAndSeedHq1770425152779 implements MigrationInterface {
  name = 'CreateBranchTablesAndSeedHq1770425152779';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."branch_type_enum" AS ENUM('branch', 'representative');
      EXCEPTION WHEN duplicate_object THEN null;
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
        "city" varchar NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "branch_call_signs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "branchId" uuid NOT NULL,
        "callSign" varchar UNIQUE NOT NULL,
        "isDefault" boolean DEFAULT false,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "branch_call_signs"
      ADD CONSTRAINT "FK_branch_call_signs_branchId"
      FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_branch_call_signs_default"
      ON "branch_call_signs" ("branchId") WHERE "isDefault" = true;
    `);

    await queryRunner.query(`
      INSERT INTO branches (id, name, type, "isHeadquarters", "isActive")
      SELECT uuid_generate_v4(), 'TRAC Genel Merkez', 'branch', true, true
      WHERE NOT EXISTS (SELECT 1 FROM branches WHERE "isHeadquarters" = true);
    `);
    const hqRow = await queryRunner.query(
      `SELECT id FROM branches WHERE "isHeadquarters" = true LIMIT 1`,
    );
    const hqId = hqRow?.[0]?.id;
    if (hqId) {
      await queryRunner.query(
        `INSERT INTO branch_call_signs ("branchId", "callSign", "isDefault")
         SELECT $1, 'TRAC', true
         WHERE NOT EXISTS (SELECT 1 FROM branch_call_signs WHERE "branchId" = $1 AND "isDefault" = true)`,
        [hqId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM branches WHERE "isHeadquarters" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_call_signs" DROP CONSTRAINT IF EXISTS "FK_branch_call_signs_branchId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_branch_call_signs_default"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "branch_call_signs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "branches"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."branch_type_enum"`);
  }
}
