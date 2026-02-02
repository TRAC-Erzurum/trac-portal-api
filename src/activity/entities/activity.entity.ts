import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ActivityType, EntityType } from '../enums/activity-type.enum';
import { User } from '../../user/entities/user.entity';

@Entity('activities')
@Index(['userId', 'createdAt'])
@Index(['entityType', 'entityId'])
@Index(['createdAt'])
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  type: ActivityType;

  @Column({ type: 'varchar', length: 20 })
  entityType: EntityType;

  @Column({ type: 'uuid', nullable: true })
  entityId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 20, nullable: true })
  actorCallSign: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  targetCallSign: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
