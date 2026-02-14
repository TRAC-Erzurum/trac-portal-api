import { MigrationInterface, QueryRunner } from 'typeorm';
import * as path from 'path';
import * as _ from 'lodash';

/**
 * Turkish-aware title case (matches shared/utils/string.utils.ts).
 * Lodash startCase uses deburr() which strips ö, ş, ğ, etc.
 */
function toTitleCase(str: string): string {
  return str
    .toLocaleLowerCase('tr-TR')
    .split(' ')
    .filter((word) => word.length > 0)
    .map(
      (word) =>
        word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1),
    )
    .join(' ');
}

/**
 * Builds wrong -> correct mapping for names that were corrupted by
 * Lodash startCase (deburr strips Turkish chars: ö→o, ş→s, ğ→g, etc.)
 */
function buildCorrectionMap(
  names: string[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const name of names) {
    if (!name || typeof name !== 'string') continue;
    const correct = toTitleCase(name.trim());
    const wrong = _.startCase(_.deburr(name.trim().toLowerCase()));
    if (wrong !== correct) {
      map[wrong] = correct;
    }
  }
  return map;
}

export class FixTurkishCharsInCityDistrict1771101059559
  implements MigrationInterface
{
  name = 'FixTurkishCharsInCityDistrict1771101059559';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const citiesPath = path.join(
      __dirname,
      '..',
      'qth',
      'repository',
      'cities.json',
    );
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cities: Array<{ name: string; districts: Array<{ name: string }> }> =
      require(citiesPath);

    const cityNames = cities.map((c) => c.name);
    const districtNames = cities.flatMap((c) =>
      (c.districts || []).map((d) => d.name),
    );

    const cityMap = buildCorrectionMap(cityNames);
    const districtMap = buildCorrectionMap(districtNames);

    // Country: "Türkiye" was often stored as "Turkiye" (deburr)
    const countryMap: Record<string, string> = {};
    const turkiyeWrong = _.startCase(_.deburr('Türkiye'.toLowerCase()));
    if (turkiyeWrong !== 'Türkiye') {
      countryMap[turkiyeWrong] = 'Türkiye';
    }

    const escape = (v: string) => v.replace(/'/g, "''");

    const runUpdates = async (
      table: string,
      column: string,
      map: Record<string, string>,
    ) => {
      const entries = Object.entries(map);
      if (entries.length === 0) return;

      const cases = entries
        .map(([wrong, correct]) => `WHEN '${escape(wrong)}' THEN '${escape(correct)}'`)
        .join(' ');
      const inList = entries
        .map(([wrong]) => `'${escape(wrong)}'`)
        .join(', ');
      await queryRunner.query(`
        UPDATE "${table}"
        SET "${column}" = CASE "${column}" ${cases} END
        WHERE "${column}" IN (${inList})
      `);
    };

    await runUpdates('operators', 'city', cityMap);
    await runUpdates('operators', 'district', districtMap);
    await runUpdates('operators', 'country', countryMap);

    await runUpdates('attendees', 'city', cityMap);
    await runUpdates('attendees', 'district', districtMap);
    await runUpdates('attendees', 'country', countryMap);

    await runUpdates('branch_communication_channels', 'district', districtMap);

    await runUpdates('branches', 'city', cityMap);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting would require storing the previous (wrong) values; we don't.
    // Data fix migrations are typically not reverted.
    // No-op.
  }
}
