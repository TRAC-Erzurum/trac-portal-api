import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupGlobalRoles1770375198174 implements MigrationInterface {
  name = 'CleanupGlobalRoles1770375198174';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users 
      SET role = 'guest', "globalRole" = 'guest'
      WHERE role IN ('member', 'volunteer', 'admin')
      AND "globalRole" != 'super_admin'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Cannot reliably reverse this migration
  }
}
