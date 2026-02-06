import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPresidentToBranchRole1770376757608 implements MigrationInterface {
  name = 'AddPresidentToBranchRole1770376757608';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TYPE "public"."branch_role_enum" ADD VALUE IF NOT EXISTS 'president';
        `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Cannot remove enum values in PostgreSQL
  }
}
