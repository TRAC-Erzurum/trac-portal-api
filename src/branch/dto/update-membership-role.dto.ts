import { IsEnum } from 'class-validator';
import { BranchRole } from '../enums/branch-role.enum';

export class UpdateMembershipRoleDto {
  @IsEnum(BranchRole)
  role: BranchRole;
}
