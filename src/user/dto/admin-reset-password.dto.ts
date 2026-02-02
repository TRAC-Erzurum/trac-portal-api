import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class AdminResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
