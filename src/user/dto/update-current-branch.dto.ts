import { IsUUID, IsNotEmpty } from 'class-validator';

export class UpdateCurrentBranchDto {
  @IsUUID()
  @IsNotEmpty()
  branchId: string;
}
