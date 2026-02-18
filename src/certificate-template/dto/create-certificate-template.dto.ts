import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CertificateTemplateElementDto {
  @IsString()
  type: 'static' | 'placeholder';

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  placeholderKey?: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsString()
  @IsNotEmpty()
  fontFamily: string;

  @IsNumber()
  fontSize: number;

  @IsString()
  @IsNotEmpty()
  color: string;
}

export class CreateCertificateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  imagePath: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificateTemplateElementDto)
  elements: CertificateTemplateElementDto[];
}
