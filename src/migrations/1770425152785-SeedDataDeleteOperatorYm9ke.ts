import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDataDeleteOperatorYm9ke1770425152785
  implements MigrationInterface
{
  name = 'SeedDataDeleteOperatorYm9ke1770425152785';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const ym9ke = await queryRunner.query(
      `SELECT id FROM operators WHERE "callSign" = 'YM9KE' LIMIT 1`,
    );
    const ym9keId = ym9ke?.[0]?.id;
    if (!ym9keId) {
      return;
    }

    const netsOfYm9ke = await queryRunner.query(
      `SELECT id FROM nets WHERE "operatorId" = $1`,
      [ym9keId],
    );
    for (const net of netsOfYm9ke || []) {
      await queryRunner.query(
        `DELETE FROM net_communication_channels WHERE "netId" = $1`,
        [net.id],
      );
      await queryRunner.query(`DELETE FROM attendees WHERE "netId" = $1`, [
        net.id,
      ]);
      await queryRunner.query(`DELETE FROM nets WHERE id = $1`, [net.id]);
    }
    await queryRunner.query(`DELETE FROM attendees WHERE "operatorId" = $1`, [
      ym9keId,
    ]);
    await queryRunner.query(`DELETE FROM operators WHERE id = $1`, [ym9keId]);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Cannot restore deleted operator and related data
  }
}
