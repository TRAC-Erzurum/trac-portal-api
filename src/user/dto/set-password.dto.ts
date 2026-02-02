import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class SetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
