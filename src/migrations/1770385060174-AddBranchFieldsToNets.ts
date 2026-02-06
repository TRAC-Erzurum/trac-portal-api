import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchFieldsToNets1770385060174 implements MigrationInterface {
  name = 'AddBranchFieldsToNets1770385060174';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add branchId column
    await queryRunner.query(`
      ALTER TABLE "nets" 
      ADD COLUMN IF NOT EXISTS "branchId" uuid NULL;
    `);

    // Add branchCallSignId column
    await queryRunner.query(`
      ALTER TABLE "nets" 
      ADD COLUMN IF NOT EXISTS "branchCallSignId" uuid NULL;
    `);

    // Add isActive column
    await queryRunner.query(`
      ALTER TABLE "nets" 
      ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true;
    `);

    // Check if there are any existing nets
    const netCountResult = await queryRunner.query(`
      SELECT COUNT(*) as count FROM "nets";
    `);
    const netCount = netCountResult && netCountResult[0] ? parseInt(netCountResult[0].count) : 0;

    if (netCount > 0) {
      // Find HQ branch (isHeadquarters=true) - required if nets exist
      const hqBranch = await queryRunner.query(`
        SELECT id FROM "branches" 
        WHERE "isHeadquarters" = true 
        LIMIT 1;
      `);

      if (!hqBranch || hqBranch.length === 0) {
        throw new Error('HQ branch must exist when migrating existing nets');
      }

      const hqBranchId = hqBranch[0].id;

      // Find default call sign for HQ branch
      const hqCallSign = await queryRunner.query(`
        SELECT id FROM "branch_call_signs" 
        WHERE "branchId" = $1 AND "isDefault" = true 
        LIMIT 1;
      `, [hqBranchId]);

      const hqCallSignId = hqCallSign && hqCallSign.length > 0 ? hqCallSign[0].id : null;

      // Set all existing nets to HQ branch
      await queryRunner.query(`
        UPDATE "nets" 
        SET "branchId" = $1, 
            "branchCallSignId" = $2,
            "isActive" = true
        WHERE "branchId" IS NULL;
      `, [hqBranchId, hqCallSignId]);
    }

    // Make branchId required after setting values (or if no nets exist, it's safe to make it NOT NULL)
    await queryRunner.query(`
      ALTER TABLE "nets" 
      ALTER COLUMN "branchId" SET NOT NULL;
    `);

    // Add foreign key constraint for branchId
    await queryRunner.query(`
      ALTER TABLE "nets" 
      ADD CONSTRAINT "FK_nets_branchId" 
      FOREIGN KEY ("branchId") 
      REFERENCES "branches"(id) 
      ON DELETE RESTRICT;
    `);

    // Add foreign key constraint for branchCallSignId
    await queryRunner.query(`
      ALTER TABLE "nets" 
      ADD CONSTRAINT "FK_nets_branchCallSignId" 
      FOREIGN KEY ("branchCallSignId") 
      REFERENCES "branch_call_signs"(id) 
      ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "nets" 
      DROP CONSTRAINT IF EXISTS "FK_nets_branchCallSignId";
    `);

    await queryRunner.query(`
      ALTER TABLE "nets" 
      DROP CONSTRAINT IF EXISTS "FK_nets_branchId";
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "nets" 
      DROP COLUMN IF EXISTS "isActive";
    `);

    await queryRunner.query(`
      ALTER TABLE "nets" 
      DROP COLUMN IF EXISTS "branchCallSignId";
    `);

    await queryRunner.query(`
      ALTER TABLE "nets" 
      DROP COLUMN IF EXISTS "branchId";
    `);
  }
}
