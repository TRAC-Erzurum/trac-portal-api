import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendeeQthSplit1741708929813 implements MigrationInterface {
  name = 'AttendeeQthSplit1741708929813';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attendees" ADD "country" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendees" ADD "city" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendees" ADD "district" character varying`,
    );

    const attendees = await queryRunner.query(`SELECT id, qth FROM attendees`);

    for (const attendee of attendees) {
      const qthParts = attendee.qth.split(',');

      if (qthParts.length === 1) {
        await queryRunner.query(
          `UPDATE "attendees" SET "city" = $1 WHERE id = $2`,
          [qthParts[0], attendee.id],
        );
      } else if (qthParts.length === 2) {
        await queryRunner.query(
          `UPDATE "attendees" SET "city" = $1, "district" = $2 WHERE id = $3`,
          [qthParts[0], qthParts[1], attendee.id],
        );
      } else if (qthParts.length === 3) {
        await queryRunner.query(
          `UPDATE "attendees" SET "city" = $1, "district" = $2, "country" = $3 WHERE id = $4`,
          [qthParts[0], qthParts[1], qthParts[2], attendee.id],
        );
      } else {
        await queryRunner.query(
          `UPDATE "attendees" SET "city" = $1, "district" = $1, "country" = $1 WHERE id = $2`,
          [attendee.qth, attendee.id],
        );
      }
    }

    await queryRunner.query(`ALTER TABLE "attendees" DROP COLUMN "qth"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attendees" ADD "qth" character varying`,
    );

    const attendees = await queryRunner.query(
      `SELECT id, city, district, country FROM attendees`,
    );

    for (const attendee of attendees) {
      let qth = attendee.city;
      if (attendee.district) {
        qth += `,${attendee.district}`;
      }
      if (attendee.country) {
        qth += `,${attendee.country}`;
      }
      await queryRunner.query(
        `UPDATE "attendees" SET "qth" = $1 WHERE id = $2`,
        [qth, attendee.id],
      );
    }

    await queryRunner.query(`ALTER TABLE "attendees" DROP COLUMN "city"`);
    await queryRunner.query(`ALTER TABLE "attendees" DROP COLUMN "district"`);
    await queryRunner.query(`ALTER TABLE "attendees" DROP COLUMN "country"`);
  }
}
