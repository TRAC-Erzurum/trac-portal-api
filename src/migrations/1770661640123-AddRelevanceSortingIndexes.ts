import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRelevanceSortingIndexes1770661640123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Attendee lookups for net co-attendance scoring
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_attendees_operator_id" ON "attendees" ("operatorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_attendees_net_id" ON "attendees" ("netId")`,
    );

    // Net date filtering (last 90 days)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_nets_ended_at" ON "nets" ("endedAt")`,
    );

    // Operator-user FK join
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_operators_user_id" ON "operators" ("userId")`,
    );

    // Case-insensitive search on callSign
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_operators_callsign_lower" ON "operators" (LOWER("callSign"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_operators_callsign_lower"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_operators_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_nets_ended_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendees_net_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendees_operator_id"`);
  }
}
