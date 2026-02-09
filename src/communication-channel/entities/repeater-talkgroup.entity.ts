import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { BranchCommunicationChannel } from './branch-communication-channel.entity';

@Entity('repeater_talkgroups')
export class RepeaterTalkgroup extends BaseEntity {
  @Column({ type: 'uuid' })
  communicationChannelId: string;

  @ManyToOne(() => BranchCommunicationChannel, (ch) => ch.talkgroups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'communicationChannelId' })
  communicationChannel: BranchCommunicationChannel;

  @Column({ type: 'int' })
  talkgroupId: number;

  @Column({ nullable: true })
  talkgroupName: string;

  @Column({ type: 'smallint', default: 1 })
  timeslot: number;

  @Column({ default: true })
  isStatic: boolean;
}
