import { IsOptional, IsString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class NetQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsOptional()
  @IsIn(['all', 'active', 'pending', 'completed'])
  status?: 'all' | 'active' | 'pending' | 'completed' = 'all';

  @IsOptional()
  @IsIn(['all', 'week', 'month', '3months'])
  dateFilter?: 'all' | 'week' | 'month' | '3months' = 'all';

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsOptional()
  @IsIn(['selected', 'my-branches', 'all'])
  branchFilter?: 'selected' | 'my-branches' | 'all';

  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  limit?: number = 50;

  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  offset?: number = 0;
}
