import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class PaginationDto {
  @IsString()
  @IsOptional()
  sort?: 'ASC' | 'DESC' = 'DESC';

  @IsNumber()
  @Min(1)
  @IsOptional()
  pageNumber?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  pageSize?: number = 50;
}
