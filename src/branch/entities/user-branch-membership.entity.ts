import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { Branch } from './branch.entity';
import { BranchRole } from '../enums/branch-role.enum';
import { MembershipStatus } from '../enums/membership-status.enum';

@Entity('user_branch_memberships')
@Unique(['userId', 'branchId'])
export class UserBranchMembership extends BaseEntity {
  @Column({ nullable: false })
  @Index()
  userId: string;

  @Column({ nullable: false })
  @Index()
  branchId: string;

  @Column({ type: 'enum', enum: BranchRole, nullable: false })
  role: BranchRole;

  @Column({ type: 'enum', enum: MembershipStatus, default: MembershipStatus.PENDING })
  status: MembershipStatus;

  @Column({ nullable: true })
  processedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason: string | null;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Branch, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
