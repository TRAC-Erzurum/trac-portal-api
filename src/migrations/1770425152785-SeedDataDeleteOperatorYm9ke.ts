import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDataDeleteOperatorYm9ke1770425152785 implements MigrationInterface {
  name = 'SeedDataDeleteOperatorYm9ke1770425152785';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const ta9a = await queryRunner.query(
      `SELECT id FROM operators WHERE "callSign" = 'TA9A' LIMIT 1`,
    );
    const ta9aId = ta9a?.[0]?.id;
    if (!ta9aId) {
      return;
    }

    const ym9ke = await queryRunner.query(
      `SELECT id FROM operators WHERE "callSign" = 'YM9KE' LIMIT 1`,
    );
    const ym9keId = ym9ke?.[0]?.id;
    if (!ym9keId) {
      return;
    }

    await queryRunner.query(
      `UPDATE nets SET "operatorId" = $1 WHERE "operatorId" = $2`,
      [ta9aId, ym9keId],
    );
    await queryRunner.query(`DELETE FROM attendees WHERE "operatorId" = $1`, [
      ym9keId,
    ]);
    await queryRunner.query(`DELETE FROM operators WHERE id = $1`, [ym9keId]);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Cannot restore deleted operator and related data
  }
}
