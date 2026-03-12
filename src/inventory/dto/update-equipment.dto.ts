import {
  IsUUID,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  IsInt,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyValueDto } from './property-value.dto';

export class UpdateEquipmentDto {
  @IsUUID()
  @IsOptional()
  statusId?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  label?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyValueDto)
  @IsOptional()
  propertyValues?: PropertyValueDto[];
}
