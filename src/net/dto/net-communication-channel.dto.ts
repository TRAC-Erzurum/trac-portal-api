import {
  IsUUID,
  IsBoolean,
  IsString,
  IsOptional,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';

export class NetCommunicationChannelDto {
  @IsUUID()
  @IsOptional()
  communicationChannelId?: string | null;

  @IsBoolean()
  @IsOptional()
  isSimplexAdHoc?: boolean;

  @ValidateIf((o) => o.isSimplexAdHoc === true)
  @IsString()
  @IsNotEmpty()
  simplexFrequency?: string | null;
}
