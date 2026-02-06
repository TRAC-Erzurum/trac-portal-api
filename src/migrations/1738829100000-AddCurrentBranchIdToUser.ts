import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrentBranchIdToUser1738829100000 implements MigrationInterface {
  name = 'AddCurrentBranchIdToUser1738829100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "currentBranchId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "currentBranchId"`,
    );
  }
}
