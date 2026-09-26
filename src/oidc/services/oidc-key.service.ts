import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  OidcSigningKey,
  RsaPublicJwk,
} from '../entities/oidc-signing-key.entity';
import { OIDC_CLOCK, OidcClock, RETIRED_KEY_GRACE_MS } from '../oidc.constants';
import { randomToken } from '../utils/secret.util';

export interface PublicJwk extends RsaPublicJwk {
  kid: string;
  alg: 'RS256';
  use: 'sig';
}

@Injectable()
export class OidcKeyService {
  constructor(
    @InjectRepository(OidcSigningKey)
    private readonly keyRepository: Repository<OidcSigningKey>,
    @Inject(OIDC_CLOCK) private readonly clock: OidcClock,
  ) {}

  private async generate(actor: string | null): Promise<OidcSigningKey> {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const kid = randomToken(16);
    const jwk = publicKey.export({ format: 'jwk' });
    return this.keyRepository.save(
      this.keyRepository.create({
        kid,
        privateKey: privateKey
          .export({ format: 'pem', type: 'pkcs8' })
          .toString(),
        publicJwk: { kty: 'RSA', n: jwk.n, e: jwk.e },
        retiredAt: null,
        createdBy: actor,
        updatedBy: [],
      }),
    );
  }

  private async activeKeys(): Promise<OidcSigningKey[]> {
    const keys = await this.keyRepository.find({
      order: { createdAt: 'DESC' },
    });
    return keys.filter((k) => !k.retiredAt);
  }

  /** The key new tokens are signed with; one is generated when none is active. */
  async getSigningKey(): Promise<OidcSigningKey> {
    const [active] = await this.activeKeys();
    return active ?? this.generate(null);
  }

  /** Retires every active key and starts signing with a fresh one. */
  async rotate(actor: string): Promise<{ kid: string }> {
    const now = this.clock();
    for (const key of await this.activeKeys()) {
      key.retiredAt = now;
      key.updatedBy = [...(key.updatedBy ?? []), actor];
      await this.keyRepository.save(key);
    }
    const fresh = await this.generate(actor);
    return { kid: fresh.kid };
  }

  /** Active keys plus keys retired less than the grace period ago. */
  async getJwks(): Promise<{ keys: PublicJwk[] }> {
    const cutoff = this.clock().getTime() - RETIRED_KEY_GRACE_MS;
    const keys = await this.keyRepository.find({
      order: { createdAt: 'DESC' },
    });
    return {
      keys: keys
        .filter((k) => !k.retiredAt || k.retiredAt.getTime() > cutoff)
        .map((k) => ({ ...k.publicJwk, kid: k.kid, alg: 'RS256', use: 'sig' })),
    };
  }
}
