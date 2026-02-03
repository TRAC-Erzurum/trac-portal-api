import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeQthTrimAndCanonical1748300000000
  implements MigrationInterface
{
  name = 'NormalizeQthTrimAndCanonical1748300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "operators"
      SET city = TRIM(city), district = TRIM(district), "fullName" = TRIM("fullName"), country = TRIM(country)
      WHERE city IS NOT NULL OR district IS NOT NULL OR "fullName" IS NOT NULL OR country IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "attendees"
      SET name = TRIM(name), city = TRIM(city), district = TRIM(district), country = TRIM(country)
      WHERE name IS NOT NULL OR city IS NOT NULL OR district IS NOT NULL OR country IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Trim is not reversible
  }
}
