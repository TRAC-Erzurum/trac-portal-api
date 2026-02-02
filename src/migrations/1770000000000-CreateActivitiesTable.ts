import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateActivitiesTable1770000000000 implements MigrationInterface {
  name = 'CreateActivitiesTable1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'activities',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'entityType',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'entityId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'actorCallSign',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'targetCallSign',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'activities',
      new TableIndex({
        name: 'IDX_activities_user_created',
        columnNames: ['userId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'activities',
      new TableIndex({
        name: 'IDX_activities_entity',
        columnNames: ['entityType', 'entityId'],
      }),
    );

    await queryRunner.createIndex(
      'activities',
      new TableIndex({
        name: 'IDX_activities_created',
        columnNames: ['createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('activities');
  }
}
