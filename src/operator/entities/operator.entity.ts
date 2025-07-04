import { Entity, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Session } from '../../session/entities/session.entity';
import { Attendee } from '../../session/entities/attendee.entity';
import { BaseEntity } from 'src/shared/entities/base.entity';

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

  @OneToOne(() => User, { eager: true })
  @JoinColumn()
  user: User;

  @OneToMany(() => Session, (session) => session.operator)
  sessions: Session[];

  @OneToMany(() => Attendee, (attendee) => attendee.operator)
  attendees: Attendee[];
}
