import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDataMembershipsTa9mfeAndNetsToErzurum1770425152787 implements MigrationInterface {
  name = 'SeedDataMembershipsTa9mfeAndNetsToErzurum1770425152787';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hqRow = await queryRunner.query(
      `SELECT id FROM branches WHERE "isHeadquarters" = true LIMIT 1`,
    );
    const hqId = hqRow?.[0]?.id;
    const erzurumRow = await queryRunner.query(
      `SELECT id FROM branches WHERE name = 'TRAC Erzurum Şubesi' LIMIT 1`,
    );
    const erzurumId = erzurumRow?.[0]?.id;
    const uhfRelayRow = erzurumId
      ? await queryRunner.query(
          `SELECT id FROM branch_communication_channels WHERE "branchId" = $1 AND name = '439.425' LIMIT 1`,
          [erzurumId],
        )
      : [];
    const uhfRelayId = uhfRelayRow?.[0]?.id;
    const erzurumCallSignRow = erzurumId
      ? await queryRunner.query(
          `SELECT id FROM branch_call_signs WHERE "branchId" = $1 AND "isDefault" = true LIMIT 1`,
          [erzurumId],
        )
      : [];
    const erzurumCallSignId = erzurumCallSignRow?.[0]?.id;

    if (hqId) {
      await queryRunner.query(
        `INSERT INTO user_branch_memberships ("userId", "branchId", role, status, "createdAt", "updatedAt", "createdBy", "updatedBy")
         SELECT u.id, $1, 'volunteer', 'approved', NOW(), NOW(), u.email, '{}'
         FROM users u
         INNER JOIN operators o ON o."userId" = u.id
         WHERE NOT EXISTS (SELECT 1 FROM user_branch_memberships ubm WHERE ubm."userId" = u.id AND ubm."branchId" = $1)`,
        [hqId],
      );
    }

    if (erzurumId && hqId) {
      await queryRunner.query(
        `INSERT INTO user_branch_memberships ("userId", "branchId", role, status, "createdAt", "updatedAt", "createdBy", "updatedBy")
         SELECT u.id, $1, COALESCE(ubm.role, 'volunteer'), 'approved', NOW(), NOW(), u.email, '{}'
         FROM users u
         INNER JOIN operators o ON o."userId" = u.id AND o."callSign" LIKE 'TA9%'
         LEFT JOIN user_branch_memberships ubm ON ubm."userId" = u.id AND ubm."branchId" = $2
         WHERE NOT EXISTS (SELECT 1 FROM user_branch_memberships m WHERE m."userId" = u.id AND m."branchId" = $1)`,
        [erzurumId, hqId],
      );
    }

    await queryRunner.query(`
      UPDATE users SET "globalRole" = 'guest' WHERE "globalRole" = 'super_admin';
    `);
    const ta9mfeUser = await queryRunner.query(
      `SELECT u.id FROM users u INNER JOIN operators o ON o."userId" = u.id WHERE o."callSign" = 'TA9MFE' LIMIT 1`,
    );
    if (ta9mfeUser?.[0]?.id) {
      await queryRunner.query(
        `UPDATE users SET "globalRole" = 'super_admin' WHERE id = $1`,
        [ta9mfeUser[0].id],
      );
    }

    if (erzurumId && erzurumCallSignId && uhfRelayId) {
      await queryRunner.query(
        `UPDATE nets SET "branchId" = $1, "branchCallSignId" = $2 WHERE "branchId" != $1 OR "branchCallSignId" IS DISTINCT FROM $2`,
        [erzurumId, erzurumCallSignId],
      );
      await queryRunner.query(
        `UPDATE net_communication_channels SET "communicationChannelId" = $1, "isSimplexAdHoc" = false, "simplexFrequency" = NULL`,
        [uhfRelayId],
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Cannot reliably reverse membership and net reassignments
  }
}
