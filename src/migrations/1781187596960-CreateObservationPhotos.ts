import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateObservationPhotos1781187596960
  implements MigrationInterface
{
  name = 'CreateObservationPhotos1781187596960';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "observation_photos" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "observationId" uuid NOT NULL,
        "filePath" varchar NOT NULL,
        "sortOrder" int NOT NULL DEFAULT 0,
        "createdAt" timestamp DEFAULT now(),
        CONSTRAINT "FK_observation_photos_observation" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_observation_photos_observationId" ON "observation_photos" ("observationId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_observation_photos_observationId";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "observation_photos";`);
  }
}
