import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNetInfrastructure1770385060175 implements MigrationInterface {
  name = 'CreateNetInfrastructure1770385060175';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "net_infrastructure" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "netId" uuid NOT NULL REFERENCES "nets"(id) ON DELETE CASCADE,
        "infrastructureId" uuid NULL REFERENCES "branch_infrastructure"(id) ON DELETE SET NULL,
        "isSimplexAdHoc" boolean DEFAULT false,
        "simplexFrequency" varchar NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      );
    `);

    // Add index on netId for faster communication channel queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_infrastructure_netId" 
      ON "net_infrastructure" ("netId");
    `);

    // Add index on infrastructureId for faster communication channel queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_infrastructure_infrastructureId" 
      ON "net_infrastructure" ("infrastructureId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_net_infrastructure_infrastructureId";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_net_infrastructure_netId";
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "net_infrastructure";
    `);
  }
}
