import { IsEnum } from 'class-validator';
import { DisasterRole } from '../enums/disaster-role.enum';

export class UpdateMemberDto {
  @IsEnum(DisasterRole)
  role: DisasterRole;
}
