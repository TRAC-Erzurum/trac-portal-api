import { IsString, IsEnum, IsOptional } from 'class-validator';
import { BranchRole } from '../enums/branch-role.enum';

export class AddMemberByCallSignDto {
  @IsString()
  callSign: string;

  @IsOptional()
  @IsEnum(BranchRole)
  role?: BranchRole;
}
