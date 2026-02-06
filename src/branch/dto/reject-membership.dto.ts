import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RejectMembershipDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
