import { IsDate, IsEnum, IsOptional } from 'class-validator';
import { IsNotEmpty } from 'class-validator';
import { IsString } from 'class-validator';
import { Mode } from 'src/shared/enums/mode.enum';
import { NetType } from 'src/shared/enums/net-type.enum';

export class UpdateNetDto {
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
  @IsEnum(NetType)
  type: NetType;

  @IsDate()
  @IsOptional()
  startedAt?: Date;

  @IsDate()
  @IsOptional()
  endedAt?: Date;
}
