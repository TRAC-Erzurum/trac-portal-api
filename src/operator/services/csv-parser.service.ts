import { Injectable, Logger } from '@nestjs/common';
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
              const normalizedCsvColumn = csvColumn.trim();
              const dataKeys = Object.keys(data);
              const matchingKey = dataKeys.find(
                (key) => key.trim().toLowerCase() === normalizedCsvColumn.toLowerCase()
              );

              if (matchingKey) {
                mappedData[field] = data[matchingKey];
              } else {
                mappedData[field] = data[normalizedCsvColumn] || data[csvColumn] || '';
              }
            }
          });
          results.push(mappedData);
        })
        .on('end', () => resolve(results))
        .on('error', (error) => {
          Logger.error('Error parsing CSV', error);
          reject(error);
        });
    });
  }
}
