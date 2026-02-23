import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReportShareTokens1771869108298 implements MigrationInterface {
  name = 'CreateReportShareTokens1771869108298';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "report_share_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token" character varying(36) NOT NULL,
        "filePath" character varying(512) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "UQ_report_share_tokens_token" UNIQUE ("token"),
        CONSTRAINT "PK_report_share_tokens" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_share_tokens"`);
  }
}
