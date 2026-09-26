import { Column, Entity, Index } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../shared/entities/base.entity';

export interface RsaPublicJwk {
  kty: 'RSA';
  n: string;
  e: string;
}

@Entity('oidc_signing_keys')
export class OidcSigningKey extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  kid: string;

  /** PKCS#8 PEM. */
  @Exclude()
  @Column({ type: 'text' })
  privateKey: string;

  @Column({ type: 'jsonb' })
  publicJwk: RsaPublicJwk;

  @Column({ type: 'timestamptz', nullable: true })
  retiredAt: Date | null;
}
