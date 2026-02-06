import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { InfrastructureType } from '../enums/infrastructure-type.enum';

export class CreateInfrastructureDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsEnum(InfrastructureType)
  @IsNotEmpty()
  type: InfrastructureType;

  @IsString()
  @IsOptional()
  repeaterMode?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsNumber()
  @IsOptional()
  altitude?: number;

  @IsString()
  @IsOptional()
  coverage?: string;

  @IsNumber()
  @IsOptional()
  rxFrequency?: number;

  @IsNumber()
  @IsOptional()
  txFrequency?: number;

  @IsString()
  @IsOptional()
  offset?: string;

  @IsNumber()
  @IsOptional()
  txCtcssTone?: number;

  @IsNumber()
  @IsOptional()
  rxCtcssTone?: number;

  @IsString()
  @IsOptional()
  txDcsCode?: string;

  @IsString()
  @IsOptional()
  txDcsPolarity?: string;

  @IsString()
  @IsOptional()
  rxDcsCode?: string;

  @IsString()
  @IsOptional()
  rxDcsPolarity?: string;

  @IsString()
  @IsOptional()
  echolinkNode?: string;

  @IsString()
  @IsOptional()
  echolinkName?: string;

  @IsNumber()
  @IsOptional()
  aprsFrequency?: number;

  @IsBoolean()
  @IsOptional()
  aprsIsIgate?: boolean;

  @IsBoolean()
  @IsOptional()
  aprsIsDigipeater?: boolean;

  @IsString()
  @IsOptional()
  aprsIgateMode?: string;

  @IsString()
  @IsOptional()
  aprsDigipeaterType?: string;

  @IsString()
  @IsOptional()
  aprsPath?: string;

  @IsString()
  @IsOptional()
  aprsServer?: string;

  @IsString()
  @IsOptional()
  digipeater?: string;

  @IsString()
  @IsOptional()
  hfFrequencyRange?: string;

  @IsString()
  @IsOptional()
  hfMode?: string;
}
