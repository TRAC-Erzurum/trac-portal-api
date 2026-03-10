import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserDetailedFields1772956643707 implements MigrationInterface {
    name = "AddUserDetailedFields1772956643707";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "addresses" jsonb DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phoneNumbers" jsonb DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "emergencyContacts" jsonb DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "profession" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "birthDate" date`);
        await queryRunner.query(`ALTER TABLE "users" ADD "idNumber" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "idNumber"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "birthDate"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "profession"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emergencyContacts"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phoneNumbers"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "addresses"`);
    }
}
