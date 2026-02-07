import { IsUUID, IsEnum, IsOptional } from 'class-validator';
import { BranchRole } from '../enums/branch-role.enum';

export class AddMemberDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsEnum(BranchRole)
  role?: BranchRole = BranchRole.MEMBER;
}
