import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAllUsersToHeadquarters1738829000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get the headquarters branch ID
    const hqResult = await queryRunner.query(`
            SELECT id FROM branches WHERE "isHeadquarters" = true LIMIT 1
        `);

    if (hqResult.length === 0) {
      console.log('No headquarters branch found, skipping migration');
      return;
    }

    const hqBranchId = hqResult[0].id;

    // Add all non-guest users who are not already members of headquarters as volunteers
    await queryRunner.query(
      `
            INSERT INTO user_branch_memberships ("userId", "branchId", role, status, "createdAt", "updatedAt", "createdBy", "updatedBy")
            SELECT 
                u.id,
                $1,
                'volunteer',
                'approved',
                NOW(),
                NOW(),
                u.email,
                ARRAY[]::character varying[]
            FROM users u
            WHERE u.role != 'guest'
            AND NOT EXISTS (
                SELECT 1 FROM user_branch_memberships ubm
                WHERE ubm."userId" = u.id AND ubm."branchId" = $1
            )
        `,
      [hqBranchId],
    );

    console.log(
      'Successfully added all non-guest users to headquarters as volunteers',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Get the headquarters branch ID
    const hqResult = await queryRunner.query(`
            SELECT id FROM branches WHERE "isHeadquarters" = true LIMIT 1
        `);

    if (hqResult.length === 0) {
      return;
    }

    const hqBranchId = hqResult[0].id;

    // Remove volunteer memberships from headquarters that were added by this migration
    await queryRunner.query(
      `
            DELETE FROM user_branch_memberships
            WHERE "branchId" = $1
            AND role = 'volunteer'
            AND status = 'approved'
        `,
      [hqBranchId],
    );
  }
}
