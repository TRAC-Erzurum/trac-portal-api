import { IsUUID, IsNotEmpty, IsEnum } from 'class-validator';
import { RelationType } from '../enums/relation-type.enum';

export class CreateEquipmentRelationDto {
  @IsUUID()
  @IsNotEmpty()
  targetEquipmentId: string;

  @IsEnum(RelationType)
  @IsNotEmpty()
  type: RelationType;
}
