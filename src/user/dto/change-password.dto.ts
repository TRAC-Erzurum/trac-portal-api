import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  currentPassword: string;
}
