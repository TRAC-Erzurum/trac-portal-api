import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSuperAdminHqMembership1738828802000
  implements MigrationInterface
{
  name = 'SeedSuperAdminHqMembership1738828802000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO user_branch_memberships (id, "userId", "branchId", role, status, "createdAt", "updatedAt", "createdBy", "updatedBy")
      SELECT uuid_generate_v4(), u.id, b.id, 'admin', 'approved', now(), now(), u.id, '{}'
      FROM users u
      CROSS JOIN branches b
      WHERE u."globalRole" = 'super_admin' AND b."isHeadquarters" = true
      AND NOT EXISTS (
        SELECT 1 FROM user_branch_memberships m
        WHERE m."userId" = u.id AND m."branchId" = b.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM user_branch_memberships
      WHERE "branchId" IN (SELECT id FROM branches WHERE "isHeadquarters" = true)
      AND "userId" IN (SELECT id FROM users WHERE "globalRole" = 'super_admin')
    `);
  }
}
