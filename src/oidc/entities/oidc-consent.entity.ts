import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { OidcClient } from './oidc-client.entity';

/** A user's remembered approval to share the listed scopes with one client. */
@Entity('oidc_consents')
@Unique(['userId', 'clientId'])
export class OidcConsent extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  /** `oidc_clients.id`, not the public client_id. */
  @Column({ type: 'uuid' })
  clientId: string;

  /** Space-separated scopes the user approved. */
  @Column({ type: 'varchar' })
  scope: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => OidcClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: OidcClient;
}
