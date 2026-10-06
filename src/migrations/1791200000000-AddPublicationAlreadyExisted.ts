import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublicationAlreadyExisted1791200000000 implements MigrationInterface {
  name = 'AddPublicationAlreadyExisted1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "publication_queue" ADD COLUMN "alreadyExisted" boolean NOT NULL DEFAULT false;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "publication_queue" DROP COLUMN IF EXISTS "alreadyExisted";`,
    );
  }
}
