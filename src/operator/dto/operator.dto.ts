import { IsNumber, IsOptional } from 'class-validator';

export class OperatorDto {
  fullName?: string;
  district?: string;
  city?: string;
  country?: string;
  gridSquare?: string;

  @IsOptional()
  @IsNumber()
  dmrId?: number | null;
}
