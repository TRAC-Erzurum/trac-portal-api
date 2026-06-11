import { IsIn, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class AdminUserListQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  hasOperator?: 'true' | 'false';

  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  limit?: number = 50;

  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  offset?: number = 0;
}
