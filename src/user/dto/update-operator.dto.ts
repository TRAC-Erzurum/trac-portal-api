import { IsNumber, IsOptional } from 'class-validator';

export class UpdateOperatorDto {
  prefix?: string;
  suffix?: string;
  gridSquare?: string;
  district?: string;
  city?: string;
  country?: string;

  @IsOptional()
  @IsNumber()
  dmrId?: number | null;
}
