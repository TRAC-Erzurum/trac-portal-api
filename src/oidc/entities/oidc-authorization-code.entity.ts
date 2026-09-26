import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { OidcClient } from './oidc-client.entity';

@Entity('oidc_authorization_codes')
export class OidcAuthorizationCode extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  codeHash: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  redirectUri: string;

  @Column({ type: 'varchar' })
  scope: string;

  @Column({ type: 'varchar', nullable: true })
  nonce: string | null;

  /** S256 challenge; null when the client did not use PKCE. */
  @Column({ type: 'varchar', nullable: true })
  codeChallenge: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => OidcClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: OidcClient;
}
