import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { Operator } from '../../operator/entities/operator.entity';
import { BranchCallSign } from '../../branch/entities/branch-call-sign.entity';
import { NetSchedulerCommunicationChannel } from './net-scheduler-communication-channel.entity';
import { NetRecurrence } from '../enums/net-recurrence.enum';

@Entity('net_schedulers')
export class NetScheduler extends BaseEntity {
  @Column()
  branchId: string;

  @Column()
  name: string;

  @Column()
  operatorId: string;

  @Column({ nullable: true })
  branchCallSignId: string | null;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'enum', enum: NetRecurrence })
  recurrence: NetRecurrence;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'time', default: '20:00:00' })
  scheduledTime: string;

  @Column({ type: 'int', default: 30 })
  estimatedDurationMinutes: number;

  @Column({ type: 'uuid', nullable: true })
  certificateTemplateId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Branch, { nullable: false })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @ManyToOne(() => Operator, { nullable: false })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  @ManyToOne(() => BranchCallSign, { nullable: true })
  @JoinColumn({ name: 'branchCallSignId' })
  branchCallSign: BranchCallSign | null;

  @OneToMany(() => NetSchedulerCommunicationChannel, (ch) => ch.scheduler, {
    cascade: true,
  })
  communicationChannels: NetSchedulerCommunicationChannel[];
}
