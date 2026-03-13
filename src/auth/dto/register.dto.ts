import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsEmail,
  IsOptional,
  IsArray,
  IsUUID,
  ArrayMinSize,
  IsBoolean,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  callSign: string;

  @IsBoolean()
  @IsNotEmpty()
  privacyAccepted: boolean;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'error.atLeastOneBranchRequired' })
  @IsUUID('4', { each: true })
  branchIds: string[];

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  gridSquare?: string;

  @IsString()
  @IsOptional()
  captchaToken?: string;
}
