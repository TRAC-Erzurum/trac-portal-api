import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { Branch } from './branch.entity';

@Entity('branch_call_signs')
@Index(['branchId', 'isDefault'], { unique: true, where: '"isDefault" = true' })
export class BranchCallSign extends BaseEntity {
  @Column({ nullable: false })
  branchId: string;

  @Column({ unique: true, nullable: false })
  callSign: string;

  @Column({ default: false })
  isDefault: boolean;

  @ManyToOne(() => Branch, (branch) => branch.callSigns, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
