import { MigrationInterface, QueryRunner } from 'typeorm';

export class MergeDuplicateOperators1748287560000
  implements MigrationInterface
{
  name = 'MergeDuplicateOperators1748287560000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔍 Starting duplicate operator detection and merge...');

    // Find all duplicate call signs
    const duplicateCallSigns = await queryRunner.query(`
      SELECT "callSign", COUNT(*) as count
      FROM "operators"
      GROUP BY "callSign"
      HAVING COUNT(*) > 1
      ORDER BY "callSign"
    `);

    console.log(`📊 Found ${duplicateCallSigns.length} duplicate call signs`);

    for (const duplicate of duplicateCallSigns) {
      console.log(
        `\n🔄 Processing duplicates for call sign: ${duplicate.callSign}`,
      );

      // Get all operators with this call sign
      const operators = await queryRunner.query(
        `
        SELECT o.id, o."callSign", o.prefix, o.suffix, o.country, o.city, o.district, 
               o."gridSquare", o."fullName", o."createdAt", o."userId",
               u.id as user_id, u.email as user_email
        FROM "operators" o
        LEFT JOIN "users" u ON o."userId" = u.id
        WHERE o."callSign" = $1
        ORDER BY 
          CASE WHEN o."userId" IS NOT NULL THEN 0 ELSE 1 END,
          o."createdAt" ASC
      `,
        [duplicate.callSign],
      );

      console.log(
        `  📋 Found ${operators.length} operators with call sign ${duplicate.callSign}`,
      );

      // Choose the master operator (one with user relationship first, then oldest)
      const masterOperator = operators[0];
      const duplicateOperators = operators.slice(1);

      console.log(
        `  ✅ Master operator: ${masterOperator.id} (${masterOperator.user_email || 'no user'})`,
      );
      console.log(
        `  🗑️  Duplicate operators to merge: ${duplicateOperators.map((op) => op.id).join(', ')}`,
      );

      // Update all sessions that reference duplicate operators
      for (const dupOp of duplicateOperators) {
        const sessionCount = await queryRunner.query(
          `
          SELECT COUNT(*) as count FROM "sessions" WHERE "operatorId" = $1
        `,
          [dupOp.id],
        );

        if (sessionCount[0].count > 0) {
          console.log(
            `    📝 Updating ${sessionCount[0].count} sessions from operator ${dupOp.id} to ${masterOperator.id}`,
          );
          await queryRunner.query(
            `
            UPDATE "sessions" SET "operatorId" = $1 WHERE "operatorId" = $2
          `,
            [masterOperator.id, dupOp.id],
          );
        }
      }

      // Update all attendees that reference duplicate operators
      for (const dupOp of duplicateOperators) {
        const attendeeCount = await queryRunner.query(
          `
          SELECT COUNT(*) as count FROM "attendees" WHERE "operatorId" = $1
        `,
          [dupOp.id],
        );

        if (attendeeCount[0].count > 0) {
          console.log(
            `    👥 Updating ${attendeeCount[0].count} attendees from operator ${dupOp.id} to ${masterOperator.id}`,
          );
          await queryRunner.query(
            `
            UPDATE "attendees" SET "operatorId" = $1 WHERE "operatorId" = $2
          `,
            [masterOperator.id, dupOp.id],
          );
        }
      }

      // Merge additional data from duplicates into master (if master is missing data)
      for (const dupOp of duplicateOperators) {
        const updates = [];
        const values = [masterOperator.id];
        let valueIndex = 2;

        // Get fresh master data
        const masterData = await queryRunner.query(
          `
          SELECT prefix, suffix, country, city, district, "gridSquare", "fullName"
          FROM "operators" WHERE id = $1
        `,
          [masterOperator.id],
        );

        const master = masterData[0];

        // Check and merge missing fields
        if (!master.prefix && dupOp.prefix) {
          updates.push(`prefix = $${valueIndex++}`);
          values.push(dupOp.prefix);
        }
        if (!master.suffix && dupOp.suffix) {
          updates.push(`suffix = $${valueIndex++}`);
          values.push(dupOp.suffix);
        }
        if (!master.country && dupOp.country) {
          updates.push(`country = $${valueIndex++}`);
          values.push(dupOp.country);
        }
        if (!master.city && dupOp.city) {
          updates.push(`city = $${valueIndex++}`);
          values.push(dupOp.city);
        }
        if (!master.district && dupOp.district) {
          updates.push(`district = $${valueIndex++}`);
          values.push(dupOp.district);
        }
        if (!master.gridSquare && dupOp.gridSquare) {
          updates.push(`"gridSquare" = $${valueIndex++}`);
          values.push(dupOp.gridSquare);
        }
        if (!master.fullName && dupOp.fullName) {
          updates.push(`"fullName" = $${valueIndex++}`);
          values.push(dupOp.fullName);
        }

        if (updates.length > 0) {
          console.log(`    📝 Merging data: ${updates.join(', ')}`);
          await queryRunner.query(
            `
            UPDATE "operators" SET ${updates.join(', ')} WHERE id = $1
          `,
            values,
          );
        }
      }

      // Delete duplicate operators (only after all relationships are updated)
      for (const dupOp of duplicateOperators) {
        console.log(`    🗑️  Deleting duplicate operator: ${dupOp.id}`);
        await queryRunner.query(`DELETE FROM "operators" WHERE id = $1`, [
          dupOp.id,
        ]);
      }

      console.log(`  ✅ Completed merge for call sign: ${duplicate.callSign}`);
    }

    // Final verification
    const remainingDuplicates = await queryRunner.query(`
      SELECT "callSign", COUNT(*) as count
      FROM "operators"
      GROUP BY "callSign"
      HAVING COUNT(*) > 1
    `);

    if (remainingDuplicates.length === 0) {
      console.log('\n✅ SUCCESS: All duplicate operators have been merged!');
    } else {
      console.log(
        `\n❌ WARNING: ${remainingDuplicates.length} duplicate call signs still exist`,
      );
      console.log('Remaining duplicates:', remainingDuplicates);
    }

    // Show final statistics
    const totalOperators = await queryRunner.query(
      `SELECT COUNT(*) as count FROM "operators"`,
    );
    const totalSessions = await queryRunner.query(
      `SELECT COUNT(*) as count FROM "sessions"`,
    );
    const totalAttendees = await queryRunner.query(
      `SELECT COUNT(*) as count FROM "attendees"`,
    );

    console.log('\n📊 Final Statistics:');
    console.log(`   Operators: ${totalOperators[0].count}`);
    console.log(`   Sessions: ${totalSessions[0].count}`);
    console.log(`   Attendees: ${totalAttendees[0].count}`);
    console.log('\n🎉 Migration completed successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log(
      '⚠️  WARNING: This migration cannot be reversed automatically.',
    );
    console.log('The duplicate operators have been permanently merged.');
    console.log(
      'To restore, you would need to restore from a database backup.',
    );
    throw new Error(
      'Cannot reverse operator merge migration - backup required',
    );
  }
}
