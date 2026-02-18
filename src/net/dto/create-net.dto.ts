import {
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NetCommunicationChannelDto } from './net-communication-channel.dto';

export class CreateNetDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  @IsNotEmpty()
  operatorId: string;

  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @IsUUID()
  @IsOptional()
  branchCallSignId?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NetCommunicationChannelDto)
  communicationChannels: NetCommunicationChannelDto[];

  /** Set by scheduler when creating nets from net-scheduler; do not send from frontend. */
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsUUID()
  schedulerId?: string;
}
