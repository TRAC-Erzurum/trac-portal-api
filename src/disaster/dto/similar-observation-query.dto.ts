import { IsEnum, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { ObservationType } from '../enums/observation-type.enum';

export class SimilarObservationQueryDto {
  @Transform(({ value }) => parseFloat(String(value)))
  @IsNumber()
  lat: number;

  @Transform(({ value }) => parseFloat(String(value)))
  @IsNumber()
  lng: number;

  @IsEnum(ObservationType)
  type: ObservationType;
}
