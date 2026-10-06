import { MigrationInterface, QueryRunner } from 'typeorm';

export class DisasterOwnedPublishTargets1791300000000 implements MigrationInterface {
  name = 'DisasterOwnedPublishTargets1791300000000';

  /**
   * A publish target now belongs to one disaster and its address names the
   * source (no separate source id), with one attempt per record and no
   * hold on a refused key. Targets and their history made under the
   * shared registry cannot be carried over: they are removed, and every
   * disaster's sharing starts switched off.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "publication_queue";`);
    await queryRunner.query(
      `UPDATE "disasters" SET "publishingEnabled" = false, "publishTargetId" = NULL;`,
    );
    await queryRunner.query(`DELETE FROM "publish_targets";`);
    await queryRunner.query(`
      ALTER TABLE "publish_targets"
        DROP COLUMN "sourceId",
        DROP COLUMN "active",
        DROP COLUMN "authFailedAt";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "publish_targets"
        ADD COLUMN "sourceId" varchar(100) NOT NULL DEFAULT '',
        ADD COLUMN "active" boolean NOT NULL DEFAULT true,
        ADD COLUMN "authFailedAt" timestamptz;
    `);
  }
}
