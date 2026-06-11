import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDmrFieldsAndRepeaterTalkgroups1770663559336 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create dmr_network_enum type
    await queryRunner.query(`
      CREATE TYPE "dmr_network_enum" AS ENUM ('brandmeister', 'tgif', 'freedmr', 'other')
    `);

    // Add DMR fields to branch_communication_channels
    await queryRunner.query(`
      ALTER TABLE "branch_communication_channels"
      ADD COLUMN "dmrColorCode" smallint NULL,
      ADD COLUMN "dmrNetwork" "dmr_network_enum" NULL,
      ADD COLUMN "dmrRepeaterId" integer NULL
    `);

    // Create repeater_talkgroups table
    await queryRunner.query(`
      CREATE TABLE "repeater_talkgroups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar array NOT NULL DEFAULT '{}',
        "communicationChannelId" uuid NOT NULL,
        "talkgroupId" integer NOT NULL,
        "talkgroupName" varchar NULL,
        "timeslot" smallint NOT NULL DEFAULT 1,
        "isStatic" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_repeater_talkgroups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_repeater_talkgroups_channel" FOREIGN KEY ("communicationChannelId")
          REFERENCES "branch_communication_channels"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_repeater_talkgroups_channelId"
      ON "repeater_talkgroups" ("communicationChannelId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_repeater_talkgroups_talkgroupId"
      ON "repeater_talkgroups" ("talkgroupId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_repeater_talkgroups_talkgroupId"`);
    await queryRunner.query(`DROP INDEX "IDX_repeater_talkgroups_channelId"`);
    await queryRunner.query(`DROP TABLE "repeater_talkgroups"`);

    await queryRunner.query(`
      ALTER TABLE "branch_communication_channels"
      DROP COLUMN "dmrRepeaterId",
      DROP COLUMN "dmrNetwork",
      DROP COLUMN "dmrColorCode"
    `);

    await queryRunner.query(`DROP TYPE "dmr_network_enum"`);
  }
}
