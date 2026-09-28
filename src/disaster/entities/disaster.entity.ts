import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { PublishTarget } from '../../publishing/entities/publish-target.entity';
import { BaseEntity } from '../../shared/entities/base.entity';
import { DisasterType } from '../enums/disaster-type.enum';
import { DisasterMembership } from './disaster-membership.entity';
import { Observation } from './observation.entity';

export interface DisasterMetadata {
  magnitude?: number;
  epicenter?: string;
  epicenterLat?: number;
  epicenterLng?: number;
  affectedCities?: string[];
}

@Entity('disasters')
export class Disaster extends BaseEntity {
  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: DisasterType,
    enumName: 'disaster_type_enum',
  })
  type: DisasterType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: DisasterMetadata | null;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  /**
   * Observations created while this is on are queued for `publishTargetId`.
   * Only the disaster's administrators change it.
   */
  @Column({ default: false })
  publishingEnabled: boolean;

  @Column({ type: 'uuid', nullable: true })
  publishTargetId: string | null;

  @ManyToOne(() => PublishTarget, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'publishTargetId',
    foreignKeyConstraintName: 'FK_disasters_publish_target',
  })
  publishTarget?: PublishTarget | null;

  @OneToMany(() => DisasterMembership, (m) => m.disaster)
  memberships: DisasterMembership[];

  @OneToMany(() => Observation, (o) => o.disaster)
  observations: Observation[];
}
