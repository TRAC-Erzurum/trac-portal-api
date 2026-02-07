import { IsEnum, IsOptional } from 'class-validator';
import { BranchRole } from '../enums/branch-role.enum';

export class ApproveMembershipDto {
  @IsOptional()
  @IsEnum(BranchRole)
  role?: BranchRole = BranchRole.MEMBER;
}
