import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { ObservationFeedbackType } from '../enums/observation-feedback-type.enum';
import { Observation } from './observation.entity';

@Entity('observation_feedbacks')
@Unique(['observationId', 'userId'])
export class ObservationFeedback extends BaseEntity {
  @Column({ type: 'uuid' })
  observationId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ObservationFeedbackType,
    enumName: 'observation_feedback_type_enum',
  })
  type: ObservationFeedbackType;

  @ManyToOne(() => Observation, (observation) => observation.feedbacks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'observationId' })
  observation: Observation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
