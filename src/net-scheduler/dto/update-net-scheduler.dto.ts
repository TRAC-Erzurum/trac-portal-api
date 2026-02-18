import {
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
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
import { NetSchedulerCommunicationChannelDto } from './create-net-scheduler.dto';

/** startDate is immutable; omit from update. */
export class UpdateNetSchedulerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  branchCallSignId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NetSchedulerCommunicationChannelDto)
  communicationChannels?: NetSchedulerCommunicationChannelDto[];

  @IsOptional()
  @IsEnum(NetRecurrence)
  recurrence?: NetRecurrence;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
  scheduledTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  estimatedDurationMinutes?: number;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  certificateTemplateId?: string | null;
}
