import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
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
  @MaxLength(100)
  @IsOptional()
  label?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean = true;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number = 1;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyValueDto)
  propertyValues: PropertyValueDto[];
}
