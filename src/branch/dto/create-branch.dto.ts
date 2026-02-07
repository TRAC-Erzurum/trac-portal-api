import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { BranchType } from '../enums/branch-type.enum';

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(BranchType)
  @IsNotEmpty()
  type: BranchType;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  callSigns: string[];

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
