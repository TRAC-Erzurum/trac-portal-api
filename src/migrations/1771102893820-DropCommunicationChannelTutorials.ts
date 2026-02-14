import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropCommunicationChannelTutorials1771102893820
  implements MigrationInterface
{
  name = 'DropCommunicationChannelTutorials1771102893820';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_communication_channel_tutorials_type_locale"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "communication_channel_tutorials"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "communication_channel_tutorials" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" "public"."communication_channel_type_enum" NOT NULL,
        "title" varchar NOT NULL,
        "content" text NOT NULL,
        "locale" varchar(5) NOT NULL,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "createdBy" varchar NULL,
        "updatedBy" varchar[] DEFAULT '{}'
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_communication_channel_tutorials_type_locale"
      ON "communication_channel_tutorials" ("type", "locale")
    `);
  }
}
