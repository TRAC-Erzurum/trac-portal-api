import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BranchType } from '../enums/branch-type.enum';

class CreateBranchCallSignDto {
  @IsString()
  @IsNotEmpty()
  callSign: string;

  @IsBoolean()
  isDefault: boolean;
}

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(BranchType)
  @IsNotEmpty()
  type: BranchType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBranchCallSignDto)
  @IsOptional()
  callSigns?: CreateBranchCallSignDto[];

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
