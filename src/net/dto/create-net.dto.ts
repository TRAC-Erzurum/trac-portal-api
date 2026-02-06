import { IsString, IsUUID, IsArray, ValidateNested, IsNotEmpty, IsOptional } from 'class-validator';
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
}
