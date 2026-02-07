import {
  IsDate,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
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
}
