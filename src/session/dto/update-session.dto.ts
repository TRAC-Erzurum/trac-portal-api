import { IsDate, IsEnum, IsOptional } from 'class-validator';
import { IsNotEmpty } from 'class-validator';
import { IsString } from 'class-validator';
import { Mode } from 'src/shared/enums/mode.enum';
import { SessionType } from 'src/shared/enums/session-type.enum';

export class UpdateSessionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  frequency: string;

  @IsEnum(Mode)
  @IsNotEmpty()
  mode: Mode;

  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @IsNotEmpty()
  @IsEnum(SessionType)
  type: SessionType;

  @IsDate()
  @IsOptional()
  startedAt?: Date;

  @IsDate()
  @IsOptional()
  endedAt?: Date;
}
