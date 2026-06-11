import { IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class DisasterQueryDto {
  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived' = 'active';

  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  limit?: number = 50;

  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  offset?: number = 0;
}
