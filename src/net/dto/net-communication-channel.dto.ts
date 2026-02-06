import { IsUUID, IsBoolean, IsString, IsOptional } from 'class-validator';

export class NetCommunicationChannelDto {
  @IsUUID()
  @IsOptional()
  communicationChannelId?: string | null;

  @IsBoolean()
  @IsOptional()
  isSimplexAdHoc?: boolean;

  @IsString()
  @IsOptional()
  simplexFrequency?: string | null;
}
