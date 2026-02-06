import { Operator } from '../../operator/entities/operator.entity';
import { Column, Entity, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Attendee } from './attendee.entity';
import { BaseEntity } from '../../shared/entities/base.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { BranchCallSign } from '../../branch/entities/branch-call-sign.entity';
import { NetCommunicationChannel } from './net-communication-channel.entity';

@Entity('nets')
export class Net extends BaseEntity {
  @Column({ unique: true, nullable: false })
  name: string;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  endedAt?: Date;

  @Column({ nullable: false })
  branchId: string;

  @Column({ nullable: true })
  branchCallSignId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Operator, (operator) => operator.nets, {
    nullable: false,
  })
  operator: Operator;

  @ManyToOne(() => Branch, {
    nullable: false,
  })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @ManyToOne(() => BranchCallSign, {
    nullable: true,
  })
  @JoinColumn({ name: 'branchCallSignId' })
  branchCallSign: BranchCallSign | null;

  @OneToMany(() => Attendee, (attendee) => attendee.net)
  attendees: Attendee[];

  @OneToMany(() => NetCommunicationChannel, (netChannel) => netChannel.net, {
    cascade: true,
  })
  communicationChannels: NetCommunicationChannel[];
}
