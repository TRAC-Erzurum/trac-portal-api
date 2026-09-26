import { Column, Entity, Index } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../shared/entities/base.entity';

@Entity('oidc_clients')
export class OidcClient extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  clientId: string;

  @Exclude()
  @Column({ type: 'varchar' })
  secretHash: string;

  @Exclude()
  @Column({ type: 'varchar' })
  secretSalt: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  redirectUris: string[];

  @Column({ default: true })
  active: boolean;
}
