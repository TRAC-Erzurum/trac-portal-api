import { IsString, IsNotEmpty } from 'class-validator';

export class DeleteBranchDto {
  @IsString()
  @IsNotEmpty()
  branchName: string;
}
