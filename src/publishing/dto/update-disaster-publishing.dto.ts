import { IsBoolean, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class UpdateDisasterPublishingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** `null` clears the selection (only while publishing is off). */
  @IsOptional()
  @ValidateIf((o) => o.targetId !== null)
  @IsUUID()
  targetId?: string | null;
}
