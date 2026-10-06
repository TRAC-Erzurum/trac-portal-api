import { Exclude } from 'class-transformer';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';

/**
 * The recipient one disaster shares its observations with. Owned by that
 * disaster (`disasters.publishTargetId`): the recipient's address already
 * names the source it set up for this disaster.
 */
@Entity('publish_targets')
export class PublishTarget extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  intakeUrl: string;

  /**
   * The key presented as a bearer token. Stored as given because it is
   * needed to send; write-only through the API and never serialised.
   */
  @Exclude()
  @Column({ type: 'varchar' })
  sharedSecret: string;
}
