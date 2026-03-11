import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OwnerType } from '../enums/owner-type.enum';
import { PropertyValueDto } from './property-value.dto';

export class CreateEquipmentDto {
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsUUID()
  @IsNotEmpty()
  statusId: string;

  @IsEnum(OwnerType)
  @IsNotEmpty()
  ownerType: OwnerType;

  @IsUUID()
  @IsOptional()
  operatorId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean = true;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyValueDto)
  propertyValues: PropertyValueDto[];
}
