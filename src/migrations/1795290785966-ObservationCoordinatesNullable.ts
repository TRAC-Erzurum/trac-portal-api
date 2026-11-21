import { MigrationInterface, QueryRunner } from 'typeorm';

export class ObservationCoordinatesNullable1795290785966 implements MigrationInterface {
  name = 'ObservationCoordinatesNullable1795290785966';

  /**
   * An observation may be located by province and district only, without
   * map coordinates. Existing rows keep their coordinates.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "observations"
        ALTER COLUMN "lat" DROP NOT NULL,
        ALTER COLUMN "lng" DROP NOT NULL;
    `);
  }

  /**
   * Restores NOT NULL only when no coordinate-less observation exists. Rows
   * are never deleted or altered to make the constraint fit.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS "count" FROM "observations" WHERE "lat" IS NULL OR "lng" IS NULL;`,
    );
    if (count > 0) {
      throw new Error(
        `Cannot restore NOT NULL on observations.lat/lng: ${count} observation(s) have no coordinates. Resolve them manually before reverting.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "observations"
        ALTER COLUMN "lat" SET NOT NULL,
        ALTER COLUMN "lng" SET NOT NULL;
    `);
  }
}
