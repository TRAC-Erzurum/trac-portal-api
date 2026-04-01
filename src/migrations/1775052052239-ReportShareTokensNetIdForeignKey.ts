import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportShareTokensNetIdForeignKey1775052052239
  implements MigrationInterface
{
  name = 'ReportShareTokensNetIdForeignKey1775052052239';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "report_share_tokens" t
      WHERE NOT EXISTS (
        SELECT 1 FROM "nets" n WHERE n."id" = t."netId"
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "report_share_tokens"
      ADD CONSTRAINT "FK_report_share_tokens_netId"
      FOREIGN KEY ("netId")
      REFERENCES "nets"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "report_share_tokens"
      DROP CONSTRAINT IF EXISTS "FK_report_share_tokens_netId"
    `);
  }
}
