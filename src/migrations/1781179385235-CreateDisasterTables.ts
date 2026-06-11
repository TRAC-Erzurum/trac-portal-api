import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDisasterTables1781179385235 implements MigrationInterface {
  name = 'CreateDisasterTables1781179385235';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."disaster_type_enum" AS ENUM ('EARTHQUAKE_DRILL');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."disaster_role_enum" AS ENUM ('ADMIN', 'FIELD_OFFICER');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."disaster_membership_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."observation_type_enum" AS ENUM (
          'COLLAPSED_BUILDING', 'DAMAGED_BUILDING', 'ROAD_BLOCKED', 'INFRASTRUCTURE_FAILURE',
          'ASSEMBLY_AREA', 'MEDICAL_POINT', 'OTHER',
          'FIRE', 'FIRE_EXTINGUISHED', 'GAS_LEAK', 'GAS_LEAK_RESOLVED',
          'ELECTRICAL_HAZARD', 'POWER_ISOLATED',
          'INJURED', 'INJURED_EVACUATED', 'DECEASED',
          'RESCUE_REQUIRED', 'RESCUE_COMPLETED',
          'RESOURCE_NEED', 'RESOURCE_DISPATCHED', 'RESOURCE_DELIVERED', 'RESOURCE_FULFILLED',
          'DEBRIS_REMOVED', 'STRUCTURE_SECURED', 'ROAD_OPENED', 'SERVICE_RESTORED'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."observation_severity_enum" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."observation_feedback_type_enum" AS ENUM ('SUPPORT', 'CONTRADICT');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "disasters" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "type" "public"."disaster_type_enum" NOT NULL,
        "metadata" jsonb NULL,
        "archivedAt" timestamptz NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "disaster_memberships" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "disasterId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" "public"."disaster_role_enum" NOT NULL,
        "status" "public"."disaster_membership_status_enum" NOT NULL DEFAULT 'APPROVED',
        "processedBy" uuid NULL,
        "processedAt" timestamptz NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}',
        CONSTRAINT "UQ_disaster_memberships_disaster_user" UNIQUE ("disasterId", "userId"),
        CONSTRAINT "FK_disaster_memberships_disaster" FOREIGN KEY ("disasterId") REFERENCES "disasters"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_disaster_memberships_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disaster_memberships_disasterId" ON "disaster_memberships" ("disasterId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disaster_memberships_userId" ON "disaster_memberships" ("userId");
    `);

    await queryRunner.query(`
      CREATE TABLE "observations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "disasterId" uuid NOT NULL,
        "parentObservationId" uuid NULL,
        "type" "public"."observation_type_enum" NOT NULL,
        "lat" double precision NOT NULL,
        "lng" double precision NOT NULL,
        "locationLabel" varchar NULL,
        "severity" "public"."observation_severity_enum" NULL,
        "description" text NULL,
        "eventTime" timestamptz NOT NULL,
        "confidenceScore" numeric NOT NULL DEFAULT 0,
        "supportCount" int NOT NULL DEFAULT 0,
        "contradictCount" int NOT NULL DEFAULT 0,
        "createdByUserId" uuid NOT NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}',
        CONSTRAINT "FK_observations_disaster" FOREIGN KEY ("disasterId") REFERENCES "disasters"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_observations_parent" FOREIGN KEY ("parentObservationId") REFERENCES "observations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_observations_createdByUser" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_observations_disasterId" ON "observations" ("disasterId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_observations_parentObservationId" ON "observations" ("parentObservationId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_observations_lat_lng" ON "observations" ("lat", "lng");
    `);

    await queryRunner.query(`
      CREATE TABLE "observation_feedbacks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "observationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "type" "public"."observation_feedback_type_enum" NOT NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}',
        CONSTRAINT "UQ_observation_feedbacks_observation_user" UNIQUE ("observationId", "userId"),
        CONSTRAINT "FK_observation_feedbacks_observation" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_observation_feedbacks_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_observation_feedbacks_observationId" ON "observation_feedbacks" ("observationId");
    `);

    await queryRunner.query(`
      CREATE TABLE "disaster_settings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "config" jsonb NOT NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);

    await queryRunner.query(`
      INSERT INTO "disaster_settings" ("config", "createdBy", "updatedBy")
      VALUES (
        '{
          "scoringWeights": {
            "create": { "ADMIN": 5, "FIELD_OFFICER": 4, "USER": 2 },
            "support": { "ADMIN": 3, "FIELD_OFFICER": 3, "USER": 1 },
            "contradict": { "ADMIN": -2, "FIELD_OFFICER": -2, "USER": -1 }
          },
          "duplicateRadiusMeters": 50,
          "conflict": { "minContradicts": 3, "ratioThreshold": 0.4 },
          "ranking": { "confidenceWeight": 1, "severityWeight": 2, "recencyHalfLifeHours": 24 }
        }'::jsonb,
        'system',
        '{}'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "observation_feedbacks" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "observations" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "disaster_memberships" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "disaster_settings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "disasters" CASCADE`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."observation_feedback_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."observation_severity_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."observation_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."disaster_membership_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."disaster_role_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."disaster_type_enum"`,
    );
  }
}
