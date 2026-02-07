import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ApprovePasswordResetDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
