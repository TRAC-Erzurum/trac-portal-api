import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  type: string;

  @IsString()
  address: string;

  @IsString()
  qth: string;
}

class EmergencyContactDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  callSign?: string;

  @IsString()
  phone: string;
}

class TrainingDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsNumber()
  @IsOptional()
  year?: number;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  picture?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  @IsOptional()
  addresses?: AddressDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  phoneNumbers?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContacts?: EmergencyContactDto[];

  @IsString()
  @IsOptional()
  profession?: string;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  idNumber?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  expertiseAreas?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrainingDto)
  @IsOptional()
  trainings?: TrainingDto[];
}
