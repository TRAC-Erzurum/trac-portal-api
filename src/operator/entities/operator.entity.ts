import { Entity, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Net } from '../../net/entities/net.entity';
import { Attendee } from '../../net/entities/attendee.entity';
import { OperatorBranchMembership } from '../../branch/entities/operator-branch-membership.entity';
import { BaseEntity } from '../../shared/entities/base.entity';

@Entity('operators')
export class Operator extends BaseEntity {
  @Column({ nullable: false, unique: true })
  callSign: string;

  @Column({ nullable: true })
  prefix: string;

  @Column({ nullable: true })
  suffix: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true })
  gridSquare: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true, type: 'int', unique: true })
  dmrId: number;

  @OneToOne(() => User, { eager: true })
  @JoinColumn()
  user: User;

  @OneToMany(() => Net, (net) => net.operator)
  nets: Net[];

  @OneToMany(() => Attendee, (attendee) => attendee.operator)
  attendees: Attendee[];

  @OneToMany(() => OperatorBranchMembership, (m) => m.operator)
  branchMemberships: OperatorBranchMembership[];
}
