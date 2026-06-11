import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class ObservationQueryDto {
  @IsOptional()
  @Transform(({ obj }) => obj.rootOnly === 'true' || obj.rootOnly === true)
  @IsBoolean()
  rootOnly?: boolean;
}
