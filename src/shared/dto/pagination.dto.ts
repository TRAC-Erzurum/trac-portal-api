import { IsOptional, IsString } from 'class-validator';

export class PaginationDto {
  @IsString()
  @IsOptional()
  sort?: 'ASC' | 'DESC' = 'DESC';
}
