import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ObservationSeverity } from '../enums/observation-severity.enum';
import { ObservationType } from '../enums/observation-type.enum';

export class CreateObservationDto {
  @IsOptional()
  @IsUUID()
  parentObservationId?: string;

  @IsEnum(ObservationType)
  type: ObservationType;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  locationLabel?: string;

  @IsOptional()
  @IsEnum(ObservationSeverity)
  severity?: ObservationSeverity;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  eventTime?: string;
}
