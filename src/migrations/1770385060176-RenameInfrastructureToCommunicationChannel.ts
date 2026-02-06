import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameInfrastructureToCommunicationChannel1770385060176 implements MigrationInterface {
  name = 'RenameInfrastructureToCommunicationChannel1770385060176';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Rename the enum type
    await queryRunner.query(`
      ALTER TYPE "public"."infrastructure_type_enum" RENAME TO "communication_channel_type_enum";
    `);

    // Step 2: Rename branch_infrastructure table to branch_communication_channels
    await queryRunner.query(`
      ALTER TABLE "branch_infrastructure" RENAME TO "branch_communication_channels";
    `);

    // Step 3: Rename infrastructure_tutorials table to communication_channel_tutorials
    await queryRunner.query(`
      ALTER TABLE "infrastructure_tutorials" RENAME TO "communication_channel_tutorials";
    `);

    // Step 4: Rename net_infrastructure table to net_communication_channels
    await queryRunner.query(`
      ALTER TABLE "net_infrastructure" RENAME TO "net_communication_channels";
    `);

    // Step 5: Rename infrastructureId column to communicationChannelId in net_communication_channels
    await queryRunner.query(`
      ALTER TABLE "net_communication_channels" RENAME COLUMN "infrastructureId" TO "communicationChannelId";
    `);

    // Step 6: Drop old indexes and create new ones for branch_communication_channels
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_branch_infrastructure_branchId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_branch_infrastructure_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_branch_infrastructure_isActive"`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_branch_communication_channels_branchId" 
      ON "branch_communication_channels" ("branchId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_branch_communication_channels_type" 
      ON "branch_communication_channels" ("type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_branch_communication_channels_isActive" 
      ON "branch_communication_channels" ("isActive");
    `);

    // Step 7: Drop old indexes and create new ones for communication_channel_tutorials
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_infrastructure_tutorials_type_locale"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_communication_channel_tutorials_type_locale" 
      ON "communication_channel_tutorials" ("type", "locale");
    `);

    // Step 8: Drop old indexes and create new ones for net_communication_channels
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_net_infrastructure_netId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_net_infrastructure_infrastructureId"`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_communication_channels_netId" 
      ON "net_communication_channels" ("netId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_communication_channels_communicationChannelId" 
      ON "net_communication_channels" ("communicationChannelId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse Step 8: Restore net_infrastructure indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_net_communication_channels_communicationChannelId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_net_communication_channels_netId"`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_infrastructure_infrastructureId" 
      ON "net_communication_channels" ("communicationChannelId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_net_infrastructure_netId" 
      ON "net_communication_channels" ("netId");
    `);

    // Reverse Step 7: Restore infrastructure_tutorials indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_communication_channel_tutorials_type_locale"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_infrastructure_tutorials_type_locale" 
      ON "communication_channel_tutorials" ("type", "locale");
    `);

    // Reverse Step 6: Restore branch_infrastructure indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_branch_communication_channels_isActive"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_branch_communication_channels_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_branch_communication_channels_branchId"`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_branch_infrastructure_isActive" 
      ON "branch_communication_channels" ("isActive");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_branch_infrastructure_type" 
      ON "branch_communication_channels" ("type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_branch_infrastructure_branchId" 
      ON "branch_communication_channels" ("branchId");
    `);

    // Reverse Step 5: Rename communicationChannelId back to infrastructureId
    await queryRunner.query(`
      ALTER TABLE "net_communication_channels" RENAME COLUMN "communicationChannelId" TO "infrastructureId";
    `);

    // Reverse Step 4: Rename net_communication_channels back to net_infrastructure
    await queryRunner.query(`
      ALTER TABLE "net_communication_channels" RENAME TO "net_infrastructure";
    `);

    // Reverse Step 3: Rename communication_channel_tutorials back to infrastructure_tutorials
    await queryRunner.query(`
      ALTER TABLE "communication_channel_tutorials" RENAME TO "infrastructure_tutorials";
    `);

    // Reverse Step 2: Rename branch_communication_channels back to branch_infrastructure
    await queryRunner.query(`
      ALTER TABLE "branch_communication_channels" RENAME TO "branch_infrastructure";
    `);

    // Reverse Step 1: Rename the enum type back
    await queryRunner.query(`
      ALTER TYPE "public"."communication_channel_type_enum" RENAME TO "infrastructure_type_enum";
    `);
  }
}
