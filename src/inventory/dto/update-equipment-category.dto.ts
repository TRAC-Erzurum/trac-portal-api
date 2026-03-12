import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateUpdateCategoryPropertyDto } from './create-update-category-property.dto';

export class UpdateEquipmentCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v != null && v !== '')
  @IsUUID()
  parentId?: string | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUpdateCategoryPropertyDto)
  @IsOptional()
  propertyDefinitions?: CreateUpdateCategoryPropertyDto[];
}
