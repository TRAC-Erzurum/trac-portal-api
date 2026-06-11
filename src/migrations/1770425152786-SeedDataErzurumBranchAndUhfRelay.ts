import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDataErzurumBranchAndUhfRelay1770425152786 implements MigrationInterface {
  name = 'SeedDataErzurumBranchAndUhfRelay1770425152786';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO branches (id, name, type, "isHeadquarters", "isActive", city)
      SELECT uuid_generate_v4(), 'TRAC Erzurum Şubesi', 'branch', false, true, 'Erzurum'
      WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'TRAC Erzurum Şubesi');
    `);
    const erzurumRow = await queryRunner.query(
      `SELECT id FROM branches WHERE name = 'TRAC Erzurum Şubesi' LIMIT 1`,
    );
    const erzurumId = erzurumRow?.[0]?.id;
    if (!erzurumId) {
      return;
    }

    await queryRunner.query(
      `INSERT INTO branch_call_signs ("branchId", "callSign", "isDefault")
       SELECT $1, 'YM9KE', true
       WHERE NOT EXISTS (SELECT 1 FROM branch_call_signs WHERE "branchId" = $1)`,
      [erzurumId],
    );

    await queryRunner.query(
      `INSERT INTO branch_communication_channels ("branchId", type, name, "isActive", "rxFrequency", "txFrequency", "createdAt", "updatedAt", "createdBy", "updatedBy")
       SELECT $1, 'vhf_uhf_repeater', '439.425', true, 439.425, 439.425, NOW(), NOW(), NULL, '{}'
       WHERE NOT EXISTS (SELECT 1 FROM branch_communication_channels WHERE "branchId" = $1 AND name = '439.425')`,
      [erzurumId],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const erzurumRow = await queryRunner.query(
      `SELECT id FROM branches WHERE name = 'TRAC Erzurum Şubesi' LIMIT 1`,
    );
    const erzurumId = erzurumRow?.[0]?.id;
    if (erzurumId) {
      await queryRunner.query(
        `DELETE FROM branch_communication_channels WHERE "branchId" = $1`,
        [erzurumId],
      );
      await queryRunner.query(
        `DELETE FROM branch_call_signs WHERE "branchId" = $1`,
        [erzurumId],
      );
    }
    await queryRunner.query(
      `DELETE FROM branches WHERE name = 'TRAC Erzurum Şubesi'`,
    );
  }
}
