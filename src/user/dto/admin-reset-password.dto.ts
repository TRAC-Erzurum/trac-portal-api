import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class AdminResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  newPassword: string;
}
