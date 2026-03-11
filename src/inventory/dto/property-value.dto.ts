import { IsUUID, IsNotEmpty, IsDefined } from 'class-validator';

export class PropertyValueDto {
  @IsUUID()
  @IsNotEmpty()
  propertyDefinitionId: string;

  @IsDefined()
  value: any;
}
