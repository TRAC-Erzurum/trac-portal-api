import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Observation } from './observation.entity';

@Entity('observation_photos')
export class ObservationPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  observationId: string;

  @ManyToOne(() => Observation, (observation) => observation.photos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'observationId' })
  observation: Observation;

  @Column({ nullable: false })
  filePath: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
