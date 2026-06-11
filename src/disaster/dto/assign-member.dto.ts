import { IsEnum, IsUUID } from 'class-validator';
import { DisasterRole } from '../enums/disaster-role.enum';

export class AssignMemberDto {
  @IsUUID()
  userId: string;

  @IsEnum(DisasterRole)
  role: DisasterRole;
}
