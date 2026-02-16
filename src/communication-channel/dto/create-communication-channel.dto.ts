import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CommunicationChannelType,
  DmrNetwork,
} from '../enums/communication-channel-type.enum';

export class TalkgroupDto {
  @IsNumber()
  talkgroupId: number;

  @IsString()
  @IsOptional()
  talkgroupName?: string;

  @IsNumber()
  @Min(1)
  @Max(2)
  timeslot: number;

  @IsBoolean()
  @IsOptional()
  isStatic?: boolean;
}

export class CreateCommunicationChannelDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsEnum(CommunicationChannelType)
  @IsNotEmpty()
  type: CommunicationChannelType;

  @IsString()
  @IsOptional()
  repeaterMode?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
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
  hfFrequencyRange?: string;

  @IsString()
  @IsOptional()
  hfMode?: string;

  // DMR fields
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(15)
  dmrColorCode?: number;

  @IsEnum(DmrNetwork)
  @IsOptional()
  dmrNetwork?: DmrNetwork;

  @IsNumber()
  @IsOptional()
  dmrRepeaterId?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TalkgroupDto)
  talkgroups?: TalkgroupDto[];
}
