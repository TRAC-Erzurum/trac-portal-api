import { Operator } from '../../operator/entities/operator.entity';
import { Mode } from '../../shared/enums/mode.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Attendee } from './attendee.entity';
import { SessionType } from '../../shared/enums/session-type.enum';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: false })
  name: string;

  @Column({ nullable: false })
  frequency: string;

  @Column({ nullable: false, type: 'enum', enum: Mode })
  mode: Mode;

  @Column({ nullable: false, type: 'enum', enum: SessionType })
  type: SessionType;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  endedAt?: Date;

  @ManyToOne(() => Operator, (operator) => operator.sessions, {
    nullable: false,
  })
  operator: Operator;

  @OneToMany(() => Attendee, (attendee) => attendee.session)
  attendees: Attendee[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
