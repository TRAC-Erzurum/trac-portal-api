import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCallsignSpaces1748287570000 implements MigrationInterface {
  name = 'FixCallsignSpaces1748287570000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔍 Starting call sign space cleanup and duplicate merge...');

    // Find all call signs that have duplicates when trimmed
    const duplicateCallSigns = await queryRunner.query(`
      SELECT TRIM("callSign") as trimmed_callsign, COUNT(*) as count
      FROM "operators"
      GROUP BY TRIM("callSign")
      HAVING COUNT(*) > 1
      ORDER BY trimmed_callsign
    `);

    console.log(
      `📊 Found ${duplicateCallSigns.length} call signs with space-related duplicates`,
    );

    for (const duplicate of duplicateCallSigns) {
      console.log(
        `\\n🔄 Processing duplicates for call sign: "${duplicate.trimmed_callsign}"`,
      );

      // Get all operators with this call sign (including space variations)
      const operators = await queryRunner.query(
        `
        SELECT o.id, o."callSign", o.prefix, o.suffix, o.country, o.city, o.district, 
               o."gridSquare", o."fullName", o."createdAt", o."userId",
               u.id as user_id, u.email as user_email, LENGTH(o."callSign") as callsign_length
        FROM "operators" o
        LEFT JOIN "users" u ON o."userId" = u.id
        WHERE TRIM(o."callSign") = $1
        ORDER BY 
          CASE WHEN o."userId" IS NOT NULL THEN 0 ELSE 1 END,
          LENGTH(o."callSign") ASC,
          o."createdAt" ASC
      `,
        [duplicate.trimmed_callsign],
      );

      console.log(`  📋 Found ${operators.length} operators with variations:`);
      operators.forEach((op, index) => {
        console.log(
          `    ${index + 1}. "${op.callSign}" (length: ${op.callsign_length}, user: ${op.user_email || 'none'})`,
        );
      });

      // Choose the master operator (user relationship > shorter callsign > oldest)
      const masterOperator = operators[0];
      const duplicateOperators = operators.slice(1);

      console.log(
        `  ✅ Master operator: ${masterOperator.id} ("${masterOperator.callSign}" - ${masterOperator.user_email || 'no user'})`,
      );
      console.log(
        `  🗑️  Duplicate operators to merge: ${duplicateOperators.map((op) => `${op.id} ("${op.callSign}")`).join(', ')}`,
      );

      // Update all attendees to point to master operator
      for (const dupOp of duplicateOperators) {
        const attendeeUpdateResult = await queryRunner.query(
          `
          UPDATE "attendees" SET "operatorId" = $1 WHERE "operatorId" = $2
        `,
          [masterOperator.id, dupOp.id],
        );
        console.log(
          `    📝 Updated ${attendeeUpdateResult[1]} attendees from ${dupOp.id} to ${masterOperator.id}`,
        );
      }

      // Update all sessions to point to master operator
      for (const dupOp of duplicateOperators) {
        const sessionUpdateResult = await queryRunner.query(
          `
          UPDATE "sessions" SET "operatorId" = $1 WHERE "operatorId" = $2
        `,
          [masterOperator.id, dupOp.id],
        );
        console.log(
          `    📝 Updated ${sessionUpdateResult[1]} sessions from ${dupOp.id} to ${masterOperator.id}`,
        );
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

      // Delete the duplicate operators
      for (const dupOp of duplicateOperators) {
        await queryRunner.query(
          `
          DELETE FROM "operators" WHERE id = $1
        `,
          [dupOp.id],
        );
        console.log(
          `    🗑️  Deleted duplicate operator: ${dupOp.id} ("${dupOp.callSign}")`,
        );
      }

      // Ensure master operator has trimmed call sign
      await queryRunner.query(
        `
        UPDATE "operators" SET "callSign" = TRIM("callSign") WHERE id = $1
      `,
        [masterOperator.id],
      );
      console.log(
        `    ✂️  Trimmed call sign for master operator: "${masterOperator.callSign}" -> "${duplicate.trimmed_callsign}"`,
      );
    }

    // Trim all call signs to prevent future issues
    console.log(
      '\\n✂️  Trimming all call signs to prevent future space issues...',
    );
    const trimResult = await queryRunner.query(`
      UPDATE "operators" SET "callSign" = TRIM("callSign") WHERE "callSign" != TRIM("callSign")
    `);
    console.log(`✅ Trimmed ${trimResult[1]} call signs`);

    console.log('\\n🎉 Call sign space cleanup completed successfully!');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️  This migration cannot be safely reverted.');
    console.log('   The merged data cannot be automatically split back.');
    console.log('   Please restore from backup if needed.');
  }
}
