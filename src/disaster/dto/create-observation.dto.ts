import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ObservationSeverity } from '../enums/observation-severity.enum';
import { ObservationType } from '../enums/observation-type.enum';

export class CreateObservationDto {
  @IsOptional()
  @IsUUID()
  parentObservationId?: string;

  @IsEnum(ObservationType)
  type: ObservationType;

  @ValidateIf((o) => !o.parentObservationId)
  @IsNumber()
  lat?: number;

  @ValidateIf((o) => !o.parentObservationId)
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
