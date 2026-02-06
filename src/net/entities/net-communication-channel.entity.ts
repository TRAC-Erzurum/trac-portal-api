import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { Net } from './net.entity';
import { BranchCommunicationChannel } from '../../communication-channel/entities/branch-communication-channel.entity';

@Entity('net_communication_channels')
@Index(['netId'])
@Index(['communicationChannelId'])
export class NetCommunicationChannel extends BaseEntity {
  @Column({ nullable: false })
  netId: string;

  @Column({ nullable: true })
  communicationChannelId: string | null;

  @Column({ default: false })
  isSimplexAdHoc: boolean;

  @Column({ nullable: true })
  simplexFrequency: string | null;

  @ManyToOne(() => Net, (net) => net.communicationChannels, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'netId' })
  net: Net;

  @ManyToOne(() => BranchCommunicationChannel, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'communicationChannelId' })
  communicationChannel: BranchCommunicationChannel | null;
}
