import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportShareTokenNetId1771871439053 implements MigrationInterface {
  name = 'ReportShareTokenNetId1771871439053';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_share_tokens" ADD COLUMN "netId" uuid`,
    );
    await queryRunner.query(`DELETE FROM "report_share_tokens"`);
    await queryRunner.query(
      `ALTER TABLE "report_share_tokens" DROP COLUMN "filePath"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_share_tokens" ALTER COLUMN "netId" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_share_tokens" ADD COLUMN "filePath" character varying(512)`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_share_tokens" DROP COLUMN "netId"`,
    );
  }
}
