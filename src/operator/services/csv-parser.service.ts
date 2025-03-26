import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse';

@Injectable()
export class CsvParserService {
  async parse(
    buffer: Buffer,
    mapping: Record<string, string>,
  ): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
      const results: Record<string, string>[] = [];

      parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
        .on('data', (data: Record<string, string>) => {
          const mappedData: Record<string, string> = {};
          Object.entries(mapping).forEach(([field, csvColumn]) => {
            if (csvColumn) {
              mappedData[field] = data[csvColumn];
            }
          });
          results.push(mappedData);
        })
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }
}
