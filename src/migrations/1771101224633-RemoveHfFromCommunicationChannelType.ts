import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveHfFromCommunicationChannelType1771101224633 implements MigrationInterface {
  name = 'RemoveHfFromCommunicationChannelType1771101224633';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "communication_channel_tutorials" WHERE type = 'hf'
    `);
    await queryRunner.query(`
      DELETE FROM "branch_communication_channels" WHERE type = 'hf'
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."communication_channel_type_enum_new" AS ENUM(
        'vhf_uhf_repeater',
        'echolink',
        'aprs'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_communication_channels"
      ALTER COLUMN "type" TYPE "public"."communication_channel_type_enum_new"
      USING type::text::"public"."communication_channel_type_enum_new"
    `);
    await queryRunner.query(`
      ALTER TABLE "communication_channel_tutorials"
      ALTER COLUMN "type" TYPE "public"."communication_channel_type_enum_new"
      USING type::text::"public"."communication_channel_type_enum_new"
    `);

    await queryRunner.query(`
      DROP TYPE "public"."communication_channel_type_enum"
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."communication_channel_type_enum_new" RENAME TO "communication_channel_type_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."communication_channel_type_enum_old" AS ENUM(
        'vhf_uhf_repeater',
        'echolink',
        'aprs',
        'hf'
      )
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."communication_channel_type_enum" RENAME TO "communication_channel_type_enum_tmp"
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."communication_channel_type_enum_old" RENAME TO "communication_channel_type_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "branch_communication_channels"
      ALTER COLUMN "type" TYPE "public"."communication_channel_type_enum"
      USING type::text::"public"."communication_channel_type_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "communication_channel_tutorials"
      ALTER COLUMN "type" TYPE "public"."communication_channel_type_enum"
      USING type::text::"public"."communication_channel_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE "public"."communication_channel_type_enum_tmp"
    `);
  }
}
