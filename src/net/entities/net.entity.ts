import { Operator } from '../../operator/entities/operator.entity';
import { Mode } from '../../shared/enums/mode.enum';
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { Attendee } from './attendee.entity';
import { NetType } from '../../shared/enums/net-type.enum';
import { BaseEntity } from '../../shared/entities/base.entity';

@Entity('nets')
export class Net extends BaseEntity {
  @Column({ unique: true, nullable: false })
  name: string;

  @Column({ nullable: false })
  frequency: string;

  @Column({ nullable: false, type: 'enum', enum: Mode })
  mode: Mode;

  @Column({ nullable: false, type: 'enum', enum: NetType })
  type: NetType;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  endedAt?: Date;

  @ManyToOne(() => Operator, (operator) => operator.nets, {
    nullable: false,
  })
  operator: Operator;

    @OneToMany(() => Attendee, (attendee) => attendee.net)
  attendees: Attendee[];
}
