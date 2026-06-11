import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CompleteSsoRegistrationDto {
  @IsString()
  @IsNotEmpty()
  callSign: string;

  @IsBoolean()
  @IsNotEmpty()
  privacyAccepted: boolean;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  gridSquare?: string;
}
