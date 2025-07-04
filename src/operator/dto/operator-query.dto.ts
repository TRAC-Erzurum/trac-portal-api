import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../shared/dto/pagination.dto';

export class OperatorQueryDto extends PaginationDto {
  @IsString()
  @IsOptional()
  search?: string;
}
