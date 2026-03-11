import {
  IsUUID,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyValueDto } from './property-value.dto';

export class UpdateEquipmentDto {
  @IsUUID()
  @IsOptional()
  statusId?: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyValueDto)
  @IsOptional()
  propertyValues?: PropertyValueDto[];
}
