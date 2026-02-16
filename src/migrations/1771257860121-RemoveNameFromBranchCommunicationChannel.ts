import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveNameFromBranchCommunicationChannel1771257860121
  implements MigrationInterface
{
  name = 'RemoveNameFromBranchCommunicationChannel1771257860121';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch_communication_channels" DROP COLUMN IF EXISTS "name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_communication_channels" ADD COLUMN "brand" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "branch_communication_channels" DROP COLUMN IF EXISTS "brand"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_communication_channels" ADD COLUMN "name" character varying`,
    );
    await queryRunner.query(
      `UPDATE "branch_communication_channels" SET "name" = '' WHERE "name" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_communication_channels" ALTER COLUMN "name" SET NOT NULL`,
    );
  }
}
