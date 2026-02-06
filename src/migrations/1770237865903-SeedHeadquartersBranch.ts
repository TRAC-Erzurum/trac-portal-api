import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedHeadquartersBranch1770237865903 implements MigrationInterface {
  name = 'SeedHeadquartersBranch1770237865903';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        hq_exists boolean;
        branch_id uuid;
      BEGIN
        SELECT EXISTS(SELECT 1 FROM branches WHERE "isHeadquarters" = true) INTO hq_exists;
        
        IF NOT hq_exists THEN
          branch_id := uuid_generate_v4();
          
          INSERT INTO branches (id, name, type, "isHeadquarters", "isActive")
          VALUES (branch_id, 'TRAC Genel Merkez', 'branch', true, true);
          
          INSERT INTO branch_call_signs ("branchId", "callSign", "isDefault")
          VALUES (branch_id, 'TRAC', true);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM branches WHERE "isHeadquarters" = true;`,
    );
  }
}
