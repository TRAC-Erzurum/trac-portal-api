import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiSelectToPropertyTypeEnum1773332603335 implements MigrationInterface {
  name = 'AddMultiSelectToPropertyTypeEnum1773332603335';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT udt_schema AS schema, udt_name AS type_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'category_property_definitions'
         AND column_name = 'type'`,
    );
    if (rows?.length > 0 && rows[0].type_name) {
      const schema = rows[0].schema || 'public';
      const typeName = rows[0].type_name;
      await queryRunner.query(
        `ALTER TYPE "${schema}"."${typeName}" ADD VALUE IF NOT EXISTS 'multi_select'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing a value from an enum safely.
    // Rolling back would require recreating the type and altering the column.
    // Leaving the value in place has no functional impact if the application
    // no longer uses it.
  }
}
