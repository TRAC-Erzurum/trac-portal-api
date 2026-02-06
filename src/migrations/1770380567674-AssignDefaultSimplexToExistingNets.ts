import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssignDefaultSimplexToExistingNets1770380567674
  implements MigrationInterface
{
  name = 'AssignDefaultSimplexToExistingNets1770380567674';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get all nets that have no communication channel
    const netsWithoutInfra = await queryRunner.query(`
      SELECT n.id 
      FROM nets n 
      LEFT JOIN net_infrastructure ni ON ni."netId" = n.id 
      WHERE ni.id IS NULL
    `);

    // For each net without communication channel, add default simplex
    for (const net of netsWithoutInfra) {
      await queryRunner.query(
        `
        INSERT INTO net_infrastructure ("id", "netId", "infrastructureId", "isSimplexAdHoc", "simplexFrequency", "createdAt", "updatedAt", "createdBy", "updatedBy")
        VALUES (uuid_generate_v4(), $1, NULL, true, '433.500', NOW(), NOW(), NULL, '{}')
      `,
        [net.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all simplex 433.500 records
    await queryRunner.query(`
      DELETE FROM net_infrastructure 
      WHERE "isSimplexAdHoc" = true AND "simplexFrequency" = '433.500'
    `);
  }
}
