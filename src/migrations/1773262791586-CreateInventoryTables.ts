import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryTables1773262791586 implements MigrationInterface {
  name = 'CreateInventoryTables1773262791586';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clean up any leftover tables from previous migration attempts
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_relations" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_property_values" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_photos" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_statuses" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "category_property_definitions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_categories" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."relation_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."owner_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."property_type_enum"`);

    // --- Enum types ---
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."property_type_enum" AS ENUM('enum', 'number', 'number_array', 'string', 'boolean', 'date');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."owner_type_enum" AS ENUM('operator', 'branch');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."relation_type_enum" AS ENUM('accessory', 'part', 'mounted', 'used_together');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // --- equipment_categories ---
    await queryRunner.query(`
      CREATE TABLE "equipment_categories" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "parentId" uuid NULL,
        "photoPath" varchar NULL,
        "sortOrder" int NOT NULL DEFAULT 0,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_categories"
      ADD CONSTRAINT "UQ_equipment_categories_name" UNIQUE ("name");
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_categories"
      ADD CONSTRAINT "FK_equipment_categories_parentId"
      FOREIGN KEY ("parentId") REFERENCES "equipment_categories"("id") ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_categories_parentId" ON "equipment_categories" ("parentId");
    `);

    // --- category_property_definitions ---
    await queryRunner.query(`
      CREATE TABLE "category_property_definitions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "categoryId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "type" "public"."property_type_enum" NOT NULL,
        "isRequired" boolean NOT NULL DEFAULT false,
        "sortOrder" int NOT NULL DEFAULT 0,
        "enumValues" jsonb NULL,
        "numberArrayMaxLength" int NULL,
        "minValue" decimal NULL,
        "maxValue" decimal NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "category_property_definitions"
      ADD CONSTRAINT "FK_category_property_definitions_categoryId"
      FOREIGN KEY ("categoryId") REFERENCES "equipment_categories"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_category_property_definitions_categoryId" ON "category_property_definitions" ("categoryId");
    `);

    // --- equipment_statuses ---
    await queryRunner.query(`
      CREATE TABLE "equipment_statuses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "color" varchar NULL,
        "sortOrder" int NOT NULL DEFAULT 0,
        "isDefault" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_statuses"
      ADD CONSTRAINT "UQ_equipment_statuses_name" UNIQUE ("name");
    `);

    // --- equipment ---
    await queryRunner.query(`
      CREATE TABLE "equipment" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "categoryId" uuid NOT NULL,
        "statusId" uuid NOT NULL,
        "ownerType" "public"."owner_type_enum" NOT NULL,
        "operatorId" uuid NULL,
        "branchId" uuid NULL,
        "label" varchar NULL,
        "note" text NULL,
        "isVisible" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment"
      ADD CONSTRAINT "FK_equipment_categoryId"
      FOREIGN KEY ("categoryId") REFERENCES "equipment_categories"("id");
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment"
      ADD CONSTRAINT "FK_equipment_statusId"
      FOREIGN KEY ("statusId") REFERENCES "equipment_statuses"("id");
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment"
      ADD CONSTRAINT "FK_equipment_operatorId"
      FOREIGN KEY ("operatorId") REFERENCES "operators"("id");
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment"
      ADD CONSTRAINT "FK_equipment_branchId"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_categoryId" ON "equipment" ("categoryId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_statusId" ON "equipment" ("statusId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_ownerType" ON "equipment" ("ownerType");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_operatorId" ON "equipment" ("operatorId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_branchId" ON "equipment" ("branchId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_isVisible" ON "equipment" ("isVisible");
    `);

    // --- equipment_photos ---
    await queryRunner.query(`
      CREATE TABLE "equipment_photos" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "equipmentId" uuid NOT NULL,
        "filePath" varchar NOT NULL,
        "sortOrder" int NOT NULL DEFAULT 0,
        "createdAt" timestamp DEFAULT now()
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_photos"
      ADD CONSTRAINT "FK_equipment_photos_equipmentId"
      FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_photos_equipmentId" ON "equipment_photos" ("equipmentId");
    `);

    // --- equipment_property_values ---
    await queryRunner.query(`
      CREATE TABLE "equipment_property_values" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "equipmentId" uuid NOT NULL,
        "propertyDefinitionId" uuid NOT NULL,
        "value" jsonb NOT NULL
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_property_values"
      ADD CONSTRAINT "FK_equipment_property_values_equipmentId"
      FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_property_values"
      ADD CONSTRAINT "FK_equipment_property_values_propertyDefinitionId"
      FOREIGN KEY ("propertyDefinitionId") REFERENCES "category_property_definitions"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_property_values_equipmentId" ON "equipment_property_values" ("equipmentId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_property_values_propertyDefinitionId" ON "equipment_property_values" ("propertyDefinitionId");
    `);

    // --- equipment_relations ---
    await queryRunner.query(`
      CREATE TABLE "equipment_relations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "sourceEquipmentId" uuid NOT NULL,
        "targetEquipmentId" uuid NOT NULL,
        "type" "public"."relation_type_enum" NOT NULL,
        "createdBy" varchar NULL,
        "createdAt" timestamp DEFAULT now()
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_relations"
      ADD CONSTRAINT "UQ_equipment_relations_source_target" UNIQUE ("sourceEquipmentId", "targetEquipmentId");
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_relations"
      ADD CONSTRAINT "FK_equipment_relations_sourceEquipmentId"
      FOREIGN KEY ("sourceEquipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      ALTER TABLE "equipment_relations"
      ADD CONSTRAINT "FK_equipment_relations_targetEquipmentId"
      FOREIGN KEY ("targetEquipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_relations_sourceEquipmentId" ON "equipment_relations" ("sourceEquipmentId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_relations_targetEquipmentId" ON "equipment_relations" ("targetEquipmentId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_equipment_relations_type" ON "equipment_relations" ("type");
    `);

    // --- Seed default equipment statuses ---
    await queryRunner.query(`
      INSERT INTO "equipment_statuses" ("id", "name", "color", "sortOrder", "isDefault", "isActive")
      VALUES
        (uuid_generate_v4(), 'Çalışır', '#22c55e', 0, true, true),
        (uuid_generate_v4(), 'Bozuk', '#ef4444', 1, false, true),
        (uuid_generate_v4(), 'Bakımda', '#eab308', 2, false, true),
        (uuid_generate_v4(), 'Bilinmiyor', '#6b7280', 3, false, true)
      ON CONFLICT ("name") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order
    await queryRunner.query(
      `ALTER TABLE "equipment_relations" DROP CONSTRAINT IF EXISTS "FK_equipment_relations_targetEquipmentId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "equipment_relations" DROP CONSTRAINT IF EXISTS "FK_equipment_relations_sourceEquipmentId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "equipment_relations" DROP CONSTRAINT IF EXISTS "UQ_equipment_relations_source_target"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_relations_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_relations_targetEquipmentId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_relations_sourceEquipmentId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_relations"`);

    await queryRunner.query(
      `ALTER TABLE "equipment_property_values" DROP CONSTRAINT IF EXISTS "FK_equipment_property_values_propertyDefinitionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "equipment_property_values" DROP CONSTRAINT IF EXISTS "FK_equipment_property_values_equipmentId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_property_values_propertyDefinitionId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_property_values_equipmentId"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "equipment_property_values"`,
    );

    await queryRunner.query(
      `ALTER TABLE "equipment_photos" DROP CONSTRAINT IF EXISTS "FK_equipment_photos_equipmentId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_photos_equipmentId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_photos"`);

    await queryRunner.query(
      `ALTER TABLE "equipment" DROP CONSTRAINT IF EXISTS "FK_equipment_branchId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "equipment" DROP CONSTRAINT IF EXISTS "FK_equipment_operatorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "equipment" DROP CONSTRAINT IF EXISTS "FK_equipment_statusId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "equipment" DROP CONSTRAINT IF EXISTS "FK_equipment_categoryId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_isVisible"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_branchId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_operatorId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_ownerType"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_statusId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_categoryId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment"`);

    await queryRunner.query(
      `ALTER TABLE "equipment_statuses" DROP CONSTRAINT IF EXISTS "UQ_equipment_statuses_name"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_statuses"`);

    await queryRunner.query(
      `ALTER TABLE "category_property_definitions" DROP CONSTRAINT IF EXISTS "FK_category_property_definitions_categoryId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_category_property_definitions_categoryId"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "category_property_definitions"`,
    );

    await queryRunner.query(
      `ALTER TABLE "equipment_categories" DROP CONSTRAINT IF EXISTS "FK_equipment_categories_parentId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "equipment_categories" DROP CONSTRAINT IF EXISTS "UQ_equipment_categories_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_equipment_categories_parentId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "equipment_categories"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."relation_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."owner_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."property_type_enum"`,
    );
  }
}
