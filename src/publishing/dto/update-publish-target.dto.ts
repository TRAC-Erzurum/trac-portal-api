import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePublishTargetDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  intakeUrl?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sourceId?: string;

  /** Write-only. Setting it clears a failed-authentication hold. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sharedSecret?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
