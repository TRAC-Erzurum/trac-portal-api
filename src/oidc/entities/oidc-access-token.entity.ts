import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../shared/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { OidcAuthorizationCode } from './oidc-authorization-code.entity';
import { OidcClient } from './oidc-client.entity';

/** Opaque bearer token accepted only by the userinfo endpoint. Stored hashed. */
@Entity('oidc_access_tokens')
export class OidcAccessToken extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  authorizationCodeId: string;

  @Column({ type: 'varchar' })
  scope: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => OidcClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: OidcClient;

  @ManyToOne(() => OidcAuthorizationCode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorizationCodeId' })
  authorizationCode: OidcAuthorizationCode;
}
