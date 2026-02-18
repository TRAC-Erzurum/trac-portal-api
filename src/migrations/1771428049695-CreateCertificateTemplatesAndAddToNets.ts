import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCertificateTemplatesAndAddToNets1771428049695
  implements MigrationInterface
{
  name = 'CreateCertificateTemplatesAndAddToNets1771428049695';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "certificate_templates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "branchId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "imagePath" varchar NOT NULL,
        "elements" jsonb NOT NULL DEFAULT '[]',
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "certificate_templates"
      ADD CONSTRAINT "FK_certificate_templates_branchId"
      FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_certificate_templates_branchId"
      ON "certificate_templates" ("branchId")
    `);

    await queryRunner.query(`
      ALTER TABLE "nets" ADD COLUMN IF NOT EXISTS "certificateTemplateId" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "nets"
      ADD CONSTRAINT "FK_nets_certificateTemplateId"
      FOREIGN KEY ("certificateTemplateId") REFERENCES "public"."certificate_templates"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nets_certificateTemplateId" ON "nets" ("certificateTemplateId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nets" DROP CONSTRAINT IF EXISTS "FK_nets_certificateTemplateId"`,
    );
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_nets_certificateTemplateId"
    `);
    await queryRunner.query(`
      ALTER TABLE "nets" DROP COLUMN IF EXISTS "certificateTemplateId"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_certificate_templates_branchId"
    `);
    await queryRunner.query(`
      ALTER TABLE "certificate_templates"
      DROP CONSTRAINT IF EXISTS "FK_certificate_templates_branchId"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "certificate_templates"
    `);
  }
}
