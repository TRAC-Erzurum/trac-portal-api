import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { ObservationSeverity } from '../enums/observation-severity.enum';
import { ObservationType } from '../enums/observation-type.enum';
import { Disaster } from './disaster.entity';
import { ObservationFeedback } from './observation-feedback.entity';
import { ObservationPhoto } from './observation-photo.entity';

@Entity('observations')
@Index(['disasterId'])
@Index(['parentObservationId'])
@Index(['lat', 'lng'])
export class Observation extends BaseEntity {
  @Column({ type: 'uuid' })
  disasterId: string;

  @Column({ type: 'uuid', nullable: true })
  parentObservationId: string | null;

  @Column({
    type: 'enum',
    enum: ObservationType,
    enumName: 'observation_type_enum',
  })
  type: ObservationType;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'varchar', nullable: true })
  locationLabel: string | null;

  @Column({
    type: 'enum',
    enum: ObservationSeverity,
    enumName: 'observation_severity_enum',
    nullable: true,
  })
  severity: ObservationSeverity | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'timestamptz' })
  eventTime: Date;

  @Column({ type: 'numeric', default: 0 })
  confidenceScore: number;

  @Column({ type: 'int', default: 0 })
  supportCount: number;

  @Column({ type: 'int', default: 0 })
  contradictCount: number;

  @Column({ type: 'uuid' })
  createdByUserId: string;

  @ManyToOne(() => Disaster, (disaster) => disaster.observations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'disasterId' })
  disaster: Disaster;

  @ManyToOne(() => Observation, (observation) => observation.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentObservationId' })
  parent: Observation | null;

  @OneToMany(() => Observation, (observation) => observation.parent)
  children: Observation[];

  @OneToMany(() => ObservationFeedback, (feedback) => feedback.observation)
  feedbacks: ObservationFeedback[];

  @OneToMany(() => ObservationPhoto, (photo) => photo.observation)
  photos: ObservationPhoto[];
}
