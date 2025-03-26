import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1740588140415 implements MigrationInterface {
  name = 'InitialSchema1740588140415';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'member', 'volunteer', 'guest')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sessions_mode_enum" AS ENUM('fm', 'am', 'ssb', 'cw', 'dmr', 'ft8', 'ft4', 'sstv', 'usb', 'lsb', 'rtty')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sessions_type_enum" AS ENUM('analog', 'digital', 'hf', 'echo-link')`,
    );

    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "fullName" character varying,
        "picture" character varying,
        "provider" character varying NOT NULL,
        "providerId" character varying,
        "password" character varying,
        "salt" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'guest',
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "attendees" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "callSign" character varying NOT NULL,
        "name" character varying,
        "qth" character varying,
        "readability" integer,
        "signalStrength" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "sessionId" uuid,
        "operatorId" uuid,
        CONSTRAINT "PK_0d01acb0e67860db61a6fb61a4a" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "frequency" character varying NOT NULL,
        "mode" "public"."sessions_mode_enum" NOT NULL,
        "type" "public"."sessions_type_enum" NOT NULL,
        "startedAt" TIMESTAMP,
        "endedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "operatorId" uuid NOT NULL,
        CONSTRAINT "UQ_ac984ccbd8b01af155e1874e8cb" UNIQUE ("name"),
        CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "operators" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "callSign" character varying NOT NULL,
        "prefix" character varying,
        "suffix" character varying,
        "country" character varying,
        "city" character varying,
        "district" character varying,
        "gridSquare" character varying,
        "fullName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid,
        CONSTRAINT "UQ_19f8f585141e822cc49c90273ee" UNIQUE ("callSign"),
        CONSTRAINT "REL_aba2e4502865254b0edaedfecd" UNIQUE ("userId"),
        CONSTRAINT "PK_3d02b3692836893720335a79d1b" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "attendees" 
      ADD CONSTRAINT "FK_9745dcd0e4dfb72736a9b7256a0" 
      FOREIGN KEY ("sessionId") 
      REFERENCES "sessions"("id") 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "attendees" 
      ADD CONSTRAINT "FK_7a7defef6cb9122832718c40817" 
      FOREIGN KEY ("operatorId") 
      REFERENCES "operators"("id") 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions" 
      ADD CONSTRAINT "FK_bdf1439751d968cf98766746bae" 
      FOREIGN KEY ("operatorId") 
      REFERENCES "operators"("id") 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "operators" 
      ADD CONSTRAINT "FK_aba2e4502865254b0edaedfecd2" 
      FOREIGN KEY ("userId") 
      REFERENCES "users"("id") 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "operators" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attendees" CASCADE`);
    await queryRunner.query('DROP EXTENSION IF EXISTS "uuid-ossp"');
  }
}
