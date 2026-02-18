import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { NetScheduler } from './net-scheduler.entity';
import { BranchCommunicationChannel } from '../../communication-channel/entities/branch-communication-channel.entity';

@Entity('net_scheduler_communication_channels')
export class NetSchedulerCommunicationChannel extends BaseEntity {
  @Column()
  schedulerId: string;

  @Column({ nullable: true })
  communicationChannelId: string | null;

  @Column({ default: false })
  isSimplexAdHoc: boolean;

  @Column({ nullable: true })
  simplexFrequency: string | null;

  @ManyToOne(() => NetScheduler, (s) => s.communicationChannels, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'schedulerId' })
  scheduler: NetScheduler;

  @ManyToOne(() => BranchCommunicationChannel, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'communicationChannelId' })
  communicationChannel: BranchCommunicationChannel | null;
}
