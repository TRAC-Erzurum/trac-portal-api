import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Choice (a): the account's current password. */
export class ConfirmGoogleLinkPasswordDto {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  captchaToken?: string;
}

/** Choice (b): the verified email owner sets a new password. */
export class SetGoogleLinkPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(256)
  newPassword: string;
}
