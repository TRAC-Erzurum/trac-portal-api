import { IsOptional, IsString } from 'class-validator';

/** application/x-www-form-urlencoded body of the token endpoint. */
export class TokenRequestDto {
  @IsOptional()
  @IsString()
  grant_type?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @IsOptional()
  @IsString()
  code_verifier?: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  client_secret?: string;
}
