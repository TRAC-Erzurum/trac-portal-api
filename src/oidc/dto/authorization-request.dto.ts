import { IsOptional, IsString } from 'class-validator';

/**
 * Raw OAuth2 authorization request parameters. Everything is optional here:
 * the service validates them so it can answer with OAuth error codes (and
 * decide whether redirecting back to the client is safe).
 */
export class AuthorizationRequestDto {
  @IsOptional()
  @IsString()
  response_type?: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  nonce?: string;

  @IsOptional()
  @IsString()
  code_challenge?: string;

  @IsOptional()
  @IsString()
  code_challenge_method?: string;
}
