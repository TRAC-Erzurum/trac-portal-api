import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** A disaster's sharing settings: who it shares with, and whether it is on. */
export class SaveDisasterPublishingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  /** The recipient's address for this disaster, which names the source in its own path. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  intakeUrl: string;

  /** Write-only. Required the first time; left out afterwards to keep the current key. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  sharedSecret?: string;

  @IsBoolean()
  enabled: boolean;
}
