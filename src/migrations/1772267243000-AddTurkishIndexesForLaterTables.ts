import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTurkishIndexesForLaterTables1772267243000
  implements MigrationInterface
{
  name = 'AddTurkishIndexesForLaterTables1772267243000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // This migration creates Turkish normalization indexes for tables that
    // didn't exist when migration 1751234567890 ran.

    // For Branch table (created in 1770425152779)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_branch_name_turkish
      ON branches (normalize_turkish(CAST(name AS TEXT)));
    `);

    // For BranchCallSign table (created in 1770425152779)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_branch_callsign_turkish
      ON branch_call_signs (normalize_turkish(CAST("callSign" AS TEXT)));
    `);

    // For Net table (created via RenameSessionToNet in 1763500000000)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_net_name_turkish
      ON nets (normalize_turkish(CAST(name AS TEXT)));
    `);

    // For CommunicationChannel table (created in 1770425152782)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_channel_description_turkish
      ON branch_communication_channels (normalize_turkish(CAST(description AS TEXT)));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_channel_location_turkish
      ON branch_communication_channels (normalize_turkish(CAST(location AS TEXT)));
    `);

    // For NetScheduler table (created in 1771411001716)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_netscheduler_name_turkish
      ON net_schedulers (normalize_turkish(CAST(name AS TEXT)));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes for tables created after migration 1751234567890
    await queryRunner.query(`DROP INDEX IF EXISTS idx_branch_name_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_branch_callsign_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_net_name_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_channel_description_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_channel_location_turkish;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_netscheduler_name_turkish;`);
  }
}
