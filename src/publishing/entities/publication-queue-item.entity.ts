import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Disaster } from '../../disaster/entities/disaster.entity';
import { Observation } from '../../disaster/entities/observation.entity';
import { BaseEntity } from '../../shared/entities/base.entity';
import { PublicationStatus } from '../enums/publication-status.enum';
import { TargetRecord } from '../types/target-record.types';
import { PublishTarget } from './publish-target.entity';

/** One observation waiting for, or done with, delivery to one target. */
@Entity('publication_queue')
@Unique('UQ_publication_queue_observation_target', [
  'observationId',
  'targetId',
])
@Index('IDX_publication_queue_status_next', ['status', 'nextAttemptAt'])
@Index('IDX_publication_queue_disaster_status', ['disasterId', 'status'])
export class PublicationQueueItem extends BaseEntity {
  @Column({ type: 'uuid' })
  observationId: string;

  @Column({ type: 'uuid' })
  disasterId: string;

  @Column({ type: 'uuid' })
  targetId: string;

  @Column({
    type: 'enum',
    enum: PublicationStatus,
    enumName: 'publication_status_enum',
    default: PublicationStatus.PENDING,
  })
  status: PublicationStatus;

  /** The record as it is sent; fixed at queue time so every retry sends the same bytes. */
  @Column({ type: 'jsonb' })
  payload: TargetRecord;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz' })
  nextAttemptAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null;

  /** Short description of the last attempt, e.g. `409` or `network: ECONNREFUSED`. */
  @Column({ type: 'varchar', nullable: true })
  lastResult: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  /** The target already had this record when it was delivered (it answered `duplicate`). */
  @Column({ type: 'boolean', default: false })
  alreadyExisted: boolean;

  @ManyToOne(() => Observation, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'observationId',
    foreignKeyConstraintName: 'FK_publication_queue_observation',
  })
  observation?: Observation;

  @ManyToOne(() => Disaster, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'disasterId',
    foreignKeyConstraintName: 'FK_publication_queue_disaster',
  })
  disaster?: Disaster;

  @ManyToOne(() => PublishTarget, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'targetId',
    foreignKeyConstraintName: 'FK_publication_queue_target',
  })
  target?: PublishTarget;
}
