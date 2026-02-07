import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreatePasswordResetRequests1769900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'password_reset_requests',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'operator_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'call_sign',
            type: 'varchar',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected', 'completed'],
            default: "'pending'",
          },
          {
            name: 'processed_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'processed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'password_reset_requests',
      new TableForeignKey({
        columnNames: ['operator_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'operators',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'password_reset_requests',
      new TableForeignKey({
        columnNames: ['processed_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('password_reset_requests');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const fk of foreignKeys) {
        await queryRunner.dropForeignKey('password_reset_requests', fk);
      }
    }
    await queryRunner.dropTable('password_reset_requests');
  }
}
