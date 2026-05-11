import { Injectable, Logger } from '@nestjs/common';
import { Workbook } from 'exceljs';

@Injectable()
export class ExcelParserService {
  async parse(
    buffer: Buffer | ArrayBufferLike,
    mapping: Record<string, string>,
  ): Promise<Record<string, string>[]> {
    try {
      const workbook = new Workbook();
      const excelBuffer = Buffer.from(buffer as ArrayBufferLike);
      const excelLoader = workbook.xlsx as { load(buffer: unknown): Promise<Workbook> };
      await excelLoader.load(excelBuffer);

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new Error('No worksheet found in Excel file');
      }

      const results: Record<string, string>[] = [];
      const headerRow = worksheet.getRow(1);
      const headers = headerRow.values as string[];

      // Process data rows starting from row 2
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const mappedData: Record<string, string> = {};
        const rowValues = row.values as (string | number | boolean | null)[];

        Object.entries(mapping).forEach(([field, excelColumn]) => {
          if (excelColumn) {
            const normalizedExcelColumn = excelColumn.trim();
            const headerIndex = headers.findIndex(
              (header) =>
                String(header).trim().toLowerCase() ===
                normalizedExcelColumn.toLowerCase(),
            );

            if (headerIndex !== -1 && rowValues[headerIndex + 1]) {
              mappedData[field] = String(rowValues[headerIndex + 1]).trim();
            } else {
              mappedData[field] = '';
            }
          }
        });

        if (Object.values(mappedData).some((v) => v)) {
          results.push(mappedData);
        }
      });

      return results;
    } catch (error) {
      Logger.error('Error parsing Excel file', error);
      throw error;
    }
  }
}