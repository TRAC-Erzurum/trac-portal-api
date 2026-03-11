import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';
import { PropertyType } from '../enums/property-type.enum';

export class UpdateCategoryPropertyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(PropertyType)
  @IsOptional()
  type?: PropertyType;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  enumValues?: string[];

  @IsNumber()
  @Min(1)
  @IsOptional()
  numberArrayMaxLength?: number;

  @IsNumber()
  @IsOptional()
  minValue?: number;

  @IsNumber()
  @IsOptional()
  maxValue?: number;
}
