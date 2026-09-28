import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePublishTargetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  intakeUrl: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sourceId: string;

  @IsString()
  @IsNotEmpty()
  sharedSecret: string;
}
