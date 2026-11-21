import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const ATTENDEE_IMPORT_MAX_ROWS = 500;

export class AttendeeImportRowDto {
  @IsInt({ message: 'error.invalidData' })
  @Min(1, { message: 'error.invalidData' })
  row: number;

  @IsString({ message: 'error.invalidData' })
  callSign: string;

  @IsOptional()
  @IsString({ message: 'error.invalidData' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'error.invalidData' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'error.invalidData' })
  district?: string;

  // Any number is accepted here. normalizeSignal falls back to 5/9 per row
  // for non-integers and out-of-range values, instead of rejecting the request.
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'error.invalidData' },
  )
  readability?: number;

  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'error.invalidData' },
  )
  signalStrength?: number;
}

export class AttendeeImportDto {
  @IsArray({ message: 'error.invalidData' })
  @ArrayMinSize(1, { message: 'error.invalidData' })
  @ArrayMaxSize(ATTENDEE_IMPORT_MAX_ROWS, { message: 'error.invalidData' })
  @ValidateNested({ each: true })
  @Type(() => AttendeeImportRowDto)
  rows: AttendeeImportRowDto[];
}
