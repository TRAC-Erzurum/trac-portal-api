import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTurkishNormalizeFunction1751234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create a PostgreSQL function for Turkish character normalization
    // This function converts Turkish special characters to their ASCII equivalents
    // and makes the text lowercase for case-insensitive search
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION normalize_turkish(text TEXT)
      RETURNS TEXT AS $$
      BEGIN
        RETURN LOWER(
          translate(
            text,
            'ŞşÇçĞğÜüÖöİıI',
            'ssccgguuooiii'
          )
        );
      END;
      $$ LANGUAGE plpgsql IMMUTABLE STRICT;
    `);

    // Create an index for the normalize_turkish function on commonly searched fields
    // This improves performance for LIKE queries using the function
    
    // For Operator table - commonly searched fields
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_operator_callsign_turkish 
      ON operators (normalize_turkish(CAST("callSign" AS TEXT)));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_operator_fullname_turkish 
      ON operators (normalize_turkish(CAST("fullName" AS TEXT)));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_operator_city_turkish 
      ON operators (normalize_turkish(CAST(city AS TEXT)));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_operator_district_turkish 
      ON operators (normalize_turkish(CAST(district AS TEXT)));
    `);

    // For User table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_fullname_turkish
      ON users (normalize_turkish(CAST("fullName" AS TEXT)));
    `);

    // Note: Indexes for other tables (branches, branch_call_signs, nets,
    // branch_communication_channels, net_schedulers) are created in a later
    // migration (1780000000001) because those tables don't exist yet at this point.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes for tables that existed at the time of this migration
    await queryRunner.query(`DROP INDEX IF EXISTS idx_operator_callsign_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_operator_fullname_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_operator_city_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_operator_district_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_fullname_turkish;`);

    // Note: Indexes for other tables are dropped in migration 1780000000001

    // Drop function
    await queryRunner.query(`DROP FUNCTION IF EXISTS normalize_turkish(TEXT);`);
  }
}
