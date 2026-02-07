import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BranchType } from '../enums/branch-type.enum';

class UpdateCallSignDto {
  @IsString()
  @IsNotEmpty()
  callSign: string;

  @IsBoolean()
  isDefault: boolean;
}

export class UpdateBranchDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(BranchType)
  @IsOptional()
  type?: BranchType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateCallSignDto)
  @IsOptional()
  callSigns?: UpdateCallSignDto[];

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;
}
