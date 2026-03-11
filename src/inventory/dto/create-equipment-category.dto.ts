import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateEquipmentCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;
}
