import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationDto } from '../../shared/dto/pagination.dto';

export class OperatorQueryDto extends PaginationDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsOptional()
  @IsIn(['all', 'registered', 'unregistered'])
  membership?: 'all' | 'registered' | 'unregistered' = 'all';
}
