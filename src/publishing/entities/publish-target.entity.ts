import { Exclude } from 'class-transformer';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';

/** An external system observations can be published to. */
@Entity('publish_targets')
export class PublishTarget extends BaseEntity {
  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  intakeUrl: string;

  /** The source id the target assigned to this portal (`X-Source-Id`). */
  @Column({ type: 'varchar', length: 100 })
  sourceId: string;

  /**
   * HMAC key for `X-Signature`. Stored as given because it is needed to sign;
   * write-only through the API and never serialised.
   */
  @Exclude()
  @Column({ type: 'varchar' })
  sharedSecret: string;

  @Column({ default: true })
  active: boolean;

  /**
   * Set when the target answered 401. Every row of the target is held until
   * its credentials are changed.
   */
  @Column({ type: 'timestamptz', nullable: true })
  authFailedAt: Date | null;
}
