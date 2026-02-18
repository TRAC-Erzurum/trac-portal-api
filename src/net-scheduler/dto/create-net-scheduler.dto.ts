import {
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NetRecurrence } from '../enums/net-recurrence.enum';

export class NetSchedulerCommunicationChannelDto {
  @IsUUID()
  @IsOptional()
  communicationChannelId?: string | null;

  @IsOptional()
  isSimplexAdHoc?: boolean;

  @IsString()
  @IsOptional()
  simplexFrequency?: string | null;
}

export class CreateNetSchedulerDto {
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
  @Type(() => NetSchedulerCommunicationChannelDto)
  communicationChannels: NetSchedulerCommunicationChannelDto[];

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsEnum(NetRecurrence)
  recurrence: NetRecurrence;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  /** Time as HH:mm (GMT+3). Default 20:00. */
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
  scheduledTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  estimatedDurationMinutes?: number;
}
