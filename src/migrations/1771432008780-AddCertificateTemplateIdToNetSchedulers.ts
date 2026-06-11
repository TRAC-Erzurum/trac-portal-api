import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCertificateTemplateIdToNetSchedulers1771432008780 implements MigrationInterface {
  name = 'AddCertificateTemplateIdToNetSchedulers1771432008780';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "net_schedulers"
      ADD COLUMN IF NOT EXISTS "certificateTemplateId" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "net_schedulers"
      ADD CONSTRAINT "FK_net_schedulers_certificateTemplateId"
      FOREIGN KEY ("certificateTemplateId")
      REFERENCES "certificate_templates"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_schedulers_certificateTemplateId"
      ON "net_schedulers" ("certificateTemplateId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "net_schedulers" DROP CONSTRAINT IF EXISTS "FK_net_schedulers_certificateTemplateId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_net_schedulers_certificateTemplateId"
    `);
    await queryRunner.query(`
      ALTER TABLE "net_schedulers" DROP COLUMN IF EXISTS "certificateTemplateId"
    `);
  }
}
