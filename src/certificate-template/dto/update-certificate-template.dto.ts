import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CertificateTemplateElementDto } from './create-certificate-template.dto';

export class UpdateCertificateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  imagePath?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificateTemplateElementDto)
  @IsOptional()
  elements?: CertificateTemplateElementDto[];
}
