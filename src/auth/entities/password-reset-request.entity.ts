import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Operator } from '../../operator/entities/operator.entity';
import { User } from '../../user/entities/user.entity';

export enum PasswordResetStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
}

@Entity('password_reset_requests')
export class PasswordResetRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Operator, { nullable: true })
  @JoinColumn({ name: 'operator_id' })
  operator: Operator | null;

  @Column({ name: 'operator_id', nullable: true })
  operatorId: string | null;

  @Column({ name: 'call_sign' })
  callSign: string;

  @Column({
    type: 'enum',
    enum: PasswordResetStatus,
    default: PasswordResetStatus.PENDING,
  })
  status: PasswordResetStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'processed_by' })
  processedByUser: User | null;

  @Column({ name: 'processed_by', nullable: true })
  processedBy: string | null;

  @Column({ name: 'processed_at', nullable: true })
  processedAt: Date | null;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
