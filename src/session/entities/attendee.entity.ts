import { Entity, Column, ManyToOne } from 'typeorm';
import { Session } from './session.entity';
import { Operator } from '../../operator/entities/operator.entity';
import { BaseEntity } from '../../shared/entities/base.entity';

@Entity('attendees')
export class Attendee extends BaseEntity {
  @Column({ nullable: false })
  callSign: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true })
  readability: number;

  @Column({ nullable: true })
  signalStrength: number;

  @ManyToOne(() => Session, (session) => session.attendees)
  session: Session;

  @ManyToOne(() => Operator, (operator) => operator.attendees)
  operator: Operator;
}
