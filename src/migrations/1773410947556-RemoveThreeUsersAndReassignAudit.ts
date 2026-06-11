import { MigrationInterface, QueryRunner } from 'typeorm';

const REMOVE_EMAILS = [
  'erztrac@gmail.com',
  'fusta64@gmail.com',
  'zekibngl@gmail.com',
];
/** Sadece erztrac için audit alanları bu email ile güncellenir; fusta64/zekibngl replace edilmez. */
const REPLACE_EMAIL = 'faruk.ozler@gmail.com';
const ERZTRAC_ONLY = 'erztrac@gmail.com';

const TABLES_WITH_AUDIT = [
  'users',
  'user_branch_memberships',
  'operators',
  'nets',
  'attendees',
  'branches',
  'net_schedulers',
  'branch_call_signs',
  'branch_communication_channels',
  'net_communication_channels',
  'certificate_templates',
  'net_scheduler_communication_channels',
];

export class RemoveThreeUsersAndReassignAudit1773410947556 implements MigrationInterface {
  name = 'RemoveThreeUsersAndReassignAudit1773410947556';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES_WITH_AUDIT) {
      await queryRunner.query(
        `UPDATE "${table}" SET "createdBy" = $1 WHERE "createdBy" = $2`,
        [REPLACE_EMAIL, ERZTRAC_ONLY],
      );
    }

    for (const table of TABLES_WITH_AUDIT) {
      await queryRunner.query(
        `UPDATE "${table}" SET "updatedBy" = (
          SELECT array_agg(new_e ORDER BY ord)
          FROM (
            SELECT ord,
              CASE WHEN e = '${ERZTRAC_ONLY.replace(/'/g, "''")}'
                THEN '${REPLACE_EMAIL.replace(/'/g, "''")}' ELSE e END AS new_e
            FROM unnest("updatedBy") WITH ORDINALITY AS t(e, ord)
          ) s
        )
        WHERE "updatedBy" && ARRAY['${ERZTRAC_ONLY.replace(/'/g, "''")}']::varchar[]`,
      );
    }

    // 3. activities: reassign userId to faruk.ozler's user where userId is one of the three
    await queryRunner.query(
      `UPDATE "activities" SET "userId" = (SELECT id FROM "users" WHERE email = $1 LIMIT 1)
       WHERE "userId" IN (SELECT id FROM "users" WHERE email IN (${REMOVE_EMAILS.map((_, i) => `$${i + 2}`).join(',')}))`,
      [REPLACE_EMAIL, ...REMOVE_EMAILS],
    );

    // 4. Remove branch memberships for the three users
    await queryRunner.query(
      `DELETE FROM "user_branch_memberships"
       WHERE "userId" IN (SELECT id FROM "users" WHERE email IN (${REMOVE_EMAILS.map((_, i) => `$${i + 1}`).join(',')}))`,
      REMOVE_EMAILS,
    );

    // 5. Delete the three users
    await queryRunner.query(
      `DELETE FROM "users" WHERE email IN (${REMOVE_EMAILS.map((_, i) => `$${i + 1}`).join(',')})`,
      REMOVE_EMAILS,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Data migration: deleted users and their memberships cannot be restored.
    // Only audit fields could be reverted if we had stored old values; we do not.
    throw new Error(
      'Cannot revert RemoveThreeUsersAndReassignAudit1773410947556: user deletion and audit reassignment are not reversible.',
    );
  }
}
