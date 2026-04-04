import { Column, Entity, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { Branch } from './branch.entity';
import { BranchRole } from '../enums/branch-role.enum';

@Entity('operator_branch_pre_memberships')
@Unique(['callSign', 'branchId'])
export class OperatorBranchPreMembership extends BaseEntity {
  @Column({ nullable: false })
  @Index()
  callSign: string;

  @Column({ nullable: false })
  @Index()
  branchId: string;

  @Column({ type: 'enum', enum: BranchRole, nullable: false })
  role: BranchRole;

  @ManyToOne(() => Branch, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
