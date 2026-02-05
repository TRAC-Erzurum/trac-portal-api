import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDmrColumns1770327089813 implements MigrationInterface {
  name = 'RemoveDmrColumns1770327089813';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "dmrId"`);
    await queryRunner.query(`ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "talkgroup"`);
    await queryRunner.query(`ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "colorCode"`);
    await queryRunner.query(`ALTER TABLE "branch_infrastructure" DROP COLUMN IF EXISTS "timeSlot"`);
    
    await queryRunner.query(`DELETE FROM "infrastructure_tutorials" WHERE "type" = 'dmr'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "branch_infrastructure" ADD COLUMN "dmrId" character varying`);
    await queryRunner.query(`ALTER TABLE "branch_infrastructure" ADD COLUMN "talkgroup" character varying`);
    await queryRunner.query(`ALTER TABLE "branch_infrastructure" ADD COLUMN "colorCode" integer`);
    await queryRunner.query(`ALTER TABLE "branch_infrastructure" ADD COLUMN "timeSlot" integer`);
  }
}
