import { MigrationInterface, QueryRunner } from 'typeorm';
import { legacyCallSignToPlain } from '../shared/utils/call-sign.util';

export class NormalizeCallSignsAndMergeDuplicateOperators1773403943017
  implements MigrationInterface
{
  name = 'NormalizeCallSignsAndMergeDuplicateOperators1773403943017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log(
      '🔍 Normalizing call signs (-/. to plain) and merging duplicate operators...',
    );

    // --- 1. Operators: compute plain for each ---
    const operators = (await queryRunner.query(
      `SELECT id, "callSign", "userId" FROM "operators"`,
    )) as { id: string; callSign: string; userId: string | null }[];

    const plainByOpId = new Map<string, string>();
    const groupByPlain = new Map<string, { id: string; userId: string | null }[]>();

    for (const op of operators) {
      const plain = legacyCallSignToPlain(op.callSign);
      plainByOpId.set(op.id, plain);
      const list = groupByPlain.get(plain) ?? [];
      list.push({ id: op.id, userId: op.userId });
      groupByPlain.set(plain, list);
    }

    // --- 2. Merge duplicate operators (same plain) ---
    for (const [plain, list] of groupByPlain) {
      if (list.length <= 1) continue;

      // Master: first with userId, else first by id (stable order)
      list.sort((a, b) => {
        if (a.userId && !b.userId) return -1;
        if (!a.userId && b.userId) return 1;
        return 0;
      });
      const masterId = list[0].id;
      const duplicateIds = list.slice(1).map((x) => x.id);

      for (const dupId of duplicateIds) {
        await queryRunner.query(
          `UPDATE "nets" SET "operatorId" = $1 WHERE "operatorId" = $2`,
          [masterId, dupId],
        );
        await queryRunner.query(
          `UPDATE "attendees" SET "operatorId" = $1 WHERE "operatorId" = $2`,
          [masterId, dupId],
        );
        const hasNetScheduler = await queryRunner.query(
          `SELECT 1 FROM "net_schedulers" WHERE "operatorId" = $1 LIMIT 1`,
          [dupId],
        );
        if (Array.isArray(hasNetScheduler) && hasNetScheduler.length > 0) {
          await queryRunner.query(
            `UPDATE "net_schedulers" SET "operatorId" = $1 WHERE "operatorId" = $2`,
            [masterId, dupId],
          );
        }
        const hasPrr = await queryRunner.query(
          `SELECT 1 FROM "password_reset_requests" WHERE "operator_id" = $1 LIMIT 1`,
          [dupId],
        );
        if (Array.isArray(hasPrr) && hasPrr.length > 0) {
          await queryRunner.query(
            `UPDATE "password_reset_requests" SET "operator_id" = $1 WHERE "operator_id" = $2`,
            [masterId, dupId],
          );
        }

        // If duplicate had user and master doesn't, move user to master
        const dupRow = await queryRunner.query(
          `SELECT "userId" FROM "operators" WHERE id = $1`,
          [dupId],
        );
        const masterRow = await queryRunner.query(
          `SELECT "userId" FROM "operators" WHERE id = $1`,
          [masterId],
        );
        const dupHasUser = dupRow[0]?.userId != null;
        const masterHasUser = masterRow[0]?.userId != null;
        if (dupHasUser && !masterHasUser) {
          await queryRunner.query(
            `UPDATE "operators" SET "userId" = $1 WHERE id = $2`,
            [dupRow[0].userId, masterId],
          );
        }
        await queryRunner.query(
          `UPDATE "operators" SET "userId" = NULL WHERE id = $1`,
          [dupId],
        );

        await queryRunner.query(`DELETE FROM "operators" WHERE id = $1`, [
          dupId,
        ]);
      }
    }

    // --- 3. Update each remaining operator's callSign to plain ---
    const remainingOps = (await queryRunner.query(
      `SELECT id FROM "operators"`,
    )) as { id: string }[];
    for (const op of remainingOps) {
      const plain = plainByOpId.get(op.id);
      if (plain != null) {
        await queryRunner.query(
          `UPDATE "operators" SET "callSign" = $1 WHERE id = $2`,
          [plain, op.id],
        );
      }
    }

    // --- 4. Branch call signs: normalize to plain ---
    const branchCallSigns = (await queryRunner.query(
      `SELECT id, "callSign", "branchId" FROM "branch_call_signs"`,
    )) as { id: string; callSign: string; branchId: string }[];

    const plainByBcsId = new Map<string, string>();
    const bcsGroupByPlain = new Map<
      string,
      { id: string; branchId: string }[]
    >();

    for (const bcs of branchCallSigns) {
      const plain = legacyCallSignToPlain(bcs.callSign);
      plainByBcsId.set(bcs.id, plain);
      const list = bcsGroupByPlain.get(plain) ?? [];
      list.push({ id: bcs.id, branchId: bcs.branchId });
      bcsGroupByPlain.set(plain, list);
    }

    // Where same plain appears in multiple rows (e.g. different branches), keep one and point nets to it
    for (const [plain, list] of bcsGroupByPlain) {
      if (list.length <= 1) continue;

      const keepId = list[0].id;
      const removeIds = list.slice(1).map((x) => x.id);

      for (const removeId of removeIds) {
        await queryRunner.query(
          `UPDATE "nets" SET "branchCallSignId" = $1 WHERE "branchCallSignId" = $2`,
          [keepId, removeId],
        );
        await queryRunner.query(
          `DELETE FROM "branch_call_signs" WHERE id = $1`,
          [removeId],
        );
      }
    }

    // Update remaining branch_call_signs to plain
    const remainingBcs = (await queryRunner.query(
      `SELECT id FROM "branch_call_signs"`,
    )) as { id: string }[];
    for (const row of remainingBcs) {
      const plain = plainByBcsId.get(row.id);
      if (plain != null) {
        await queryRunner.query(
          `UPDATE "branch_call_signs" SET "callSign" = $1 WHERE id = $2`,
          [plain, row.id],
        );
      }
    }

    // --- 5. Attendees (participant list): replace hyphen with slash in callSign ---
    await queryRunner.query(
      `UPDATE "attendees" SET "callSign" = REPLACE("callSign", '-', '/') WHERE "callSign" LIKE '%-%'`,
    );

    console.log('✅ Call sign normalization and operator merge completed.');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'Cannot reverse call sign normalization - backup required',
    );
  }
}
