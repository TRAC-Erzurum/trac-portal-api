import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NetCommunicationChannelDto } from './net-communication-channel.dto';

export class UpdateNetDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @IsUUID()
  @IsOptional()
  branchCallSignId?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NetCommunicationChannelDto)
  @IsOptional()
  communicationChannels?: NetCommunicationChannelDto[];

  @IsDate()
  @IsOptional()
  startedAt?: Date;

  @IsDate()
  @IsOptional()
  endedAt?: Date;

  /** ISO timestamp; display-only indicator for when the net was scheduled. */
  @IsOptional()
  @IsString()
  scheduledAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  estimatedDurationMinutes?: number | null;
}
