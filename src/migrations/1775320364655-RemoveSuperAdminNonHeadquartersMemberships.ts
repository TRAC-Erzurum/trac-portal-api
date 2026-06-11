import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSuperAdminNonHeadquartersMemberships1775320364655 implements MigrationInterface {
  name = 'RemoveSuperAdminNonHeadquartersMemberships1775320364655';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_branch_memberships" ubm
      USING "users" u, "branches" b
      WHERE ubm."userId" = u.id
        AND u."globalRole" = 'super_admin'
        AND ubm."branchId" = b.id
        AND b."isHeadquarters" = false
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Üyelik satırları geri yüklenmez; veri kaybı içerir.
  }
}
