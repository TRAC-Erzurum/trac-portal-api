import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';
import { PropertyType } from '../enums/property-type.enum';

export class CreateCategoryPropertyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(PropertyType)
  @IsNotEmpty()
  type: PropertyType;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean = false;

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
