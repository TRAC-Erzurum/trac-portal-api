import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExpertiseAndTrainingsToUsers1772967705755 implements MigrationInterface {
    name = "AddExpertiseAndTrainingsToUsers1772967705755";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "expertiseAreas" jsonb DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "trainings" jsonb DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "trainings"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "expertiseAreas"`);
    }
}
