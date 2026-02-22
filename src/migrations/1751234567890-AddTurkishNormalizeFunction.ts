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
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(
                      REPLACE(
                        REPLACE(
                          REPLACE(
                            REPLACE(text, 'Ş', 's'),
                          'ş', 's'),
                        'Ç', 'c'),
                      'ç', 'c'),
                    'Ğ', 'g'),
                  'ğ', 'g'),
                'Ü', 'u'),
              'ü', 'u'),
            'Ö', 'o'),
          'ö', 'o'),
        'İ', 'i'),
      'ı', 'i'),
      'I', 'i'
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

    // For Branch table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_branch_name_turkish 
      ON branches (normalize_turkish(CAST(name AS TEXT)));
    `);

    // For BranchCallSign table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_branch_callsign_turkish 
      ON branch_call_signs (normalize_turkish(CAST("callSign" AS TEXT)));
    `);

    // For Net table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_net_name_turkish 
      ON nets (normalize_turkish(CAST(name AS TEXT)));
    `);

    // For CommunicationChannel table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_channel_description_turkish 
      ON branch_communication_channels (normalize_turkish(CAST(description AS TEXT)));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_channel_location_turkish 
      ON branch_communication_channels (normalize_turkish(CAST(location AS TEXT)));
    `);

    // For NetScheduler table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_netscheduler_name_turkish 
      ON net_schedulers (normalize_turkish(CAST(name AS TEXT)));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_operator_callsign_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_operator_fullname_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_operator_city_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_operator_district_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_user_fullname_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_branch_name_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_branch_callsign_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_net_name_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_channel_description_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_channel_location_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_netscheduler_name_turkish;`);

    // Drop function
    await queryRunner.query(`DROP FUNCTION IF EXISTS normalize_turkish(TEXT);`);
  }
}
