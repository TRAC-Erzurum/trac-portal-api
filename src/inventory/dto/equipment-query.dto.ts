import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../shared/dto/pagination.dto';

export class EquipmentQueryDto extends PaginationDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  statusId?: string;
}
