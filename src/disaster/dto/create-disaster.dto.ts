import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DisasterType } from '../enums/disaster-type.enum';
import { DisasterMetadata } from '../entities/disaster.entity';

class DisasterMetadataDto implements DisasterMetadata {
  @IsOptional()
  magnitude?: number;

  @IsOptional()
  @IsString()
  epicenter?: string;

  @IsOptional()
  @IsNumber()
  epicenterLat?: number;

  @IsOptional()
  @IsNumber()
  epicenterLng?: number;

  @IsOptional()
  @IsString({ each: true })
  affectedCities?: string[];
}

export class CreateDisasterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(DisasterType)
  type: DisasterType;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DisasterMetadataDto)
  metadata?: DisasterMetadataDto;
}
