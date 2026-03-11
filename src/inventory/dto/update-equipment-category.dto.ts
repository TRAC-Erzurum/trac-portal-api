import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateEquipmentCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
