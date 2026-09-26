import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOidcClientDto {
  @IsString({ message: 'error.oidcClientNameRequired' })
  @IsNotEmpty({ message: 'error.oidcClientNameRequired' })
  @MaxLength(200)
  name: string;

  @IsArray({ message: 'error.oidcRedirectUriRequired' })
  @ArrayMinSize(1, { message: 'error.oidcRedirectUriRequired' })
  @IsString({ each: true, message: 'error.oidcRedirectUriInvalid' })
  redirectUris: string[];
}
