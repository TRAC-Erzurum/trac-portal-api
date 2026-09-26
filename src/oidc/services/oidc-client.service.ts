import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OidcClient } from '../entities/oidc-client.entity';
import { CreateOidcClientDto } from '../dto/create-oidc-client.dto';
import {
  generateSalt,
  hashSecret,
  randomToken,
  verifySecret,
} from '../utils/secret.util';

export interface OidcClientView {
  id: string;
  clientId: string;
  name: string;
  redirectUris: string[];
  active: boolean;
  createdAt: Date;
}

/** Returned only by create and rotate: the one moment the secret is visible. */
export interface OidcClientWithSecret {
  client: OidcClientView;
  clientSecret: string;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Absolute https URL without fragment; plain http only for loopback development. */
export function isAcceptableRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || value.includes('#')) return false;
  if (url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

@Injectable()
export class OidcClientService {
  constructor(
    @InjectRepository(OidcClient)
    private readonly clientRepository: Repository<OidcClient>,
  ) {}

  private toView(client: OidcClient): OidcClientView {
    return {
      id: client.id,
      clientId: client.clientId,
      name: client.name,
      redirectUris: client.redirectUris,
      active: client.active,
      createdAt: client.createdAt,
    };
  }

  async list(): Promise<OidcClientView[]> {
    const clients = await this.clientRepository.find({
      order: { createdAt: 'DESC' },
    });
    return clients.map((c) => this.toView(c));
  }

  async create(
    dto: CreateOidcClientDto,
    actorEmail: string,
  ): Promise<OidcClientWithSecret> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('error.oidcClientNameRequired');
    const redirectUris = [...new Set(dto.redirectUris.map((u) => u.trim()))];
    if (!redirectUris.every(isAcceptableRedirectUri)) {
      throw new BadRequestException('error.oidcRedirectUriInvalid');
    }

    const clientSecret = randomToken();
    const secretSalt = generateSalt();
    const saved = await this.clientRepository.save(
      this.clientRepository.create({
        clientId: randomToken(16),
        name,
        redirectUris,
        secretSalt,
        secretHash: hashSecret(clientSecret, secretSalt),
        active: true,
        createdBy: actorEmail,
        updatedBy: [],
      }),
    );
    return { client: this.toView(saved), clientSecret };
  }

  private async findById(id: string): Promise<OidcClient> {
    const client = await this.clientRepository.findOne({ where: { id } });
    if (!client) throw new NotFoundException('error.oidcClientNotFound');
    return client;
  }

  async rotateSecret(
    id: string,
    actorEmail: string,
  ): Promise<OidcClientWithSecret> {
    const client = await this.findById(id);
    const clientSecret = randomToken();
    client.secretSalt = generateSalt();
    client.secretHash = hashSecret(clientSecret, client.secretSalt);
    client.updatedBy = [...(client.updatedBy ?? []), actorEmail];
    const saved = await this.clientRepository.save(client);
    return { client: this.toView(saved), clientSecret };
  }

  async deactivate(id: string, actorEmail: string): Promise<OidcClientView> {
    const client = await this.findById(id);
    client.active = false;
    client.updatedBy = [...(client.updatedBy ?? []), actorEmail];
    return this.toView(await this.clientRepository.save(client));
  }

  async findActiveByClientId(
    clientId: string | undefined,
  ): Promise<OidcClient | null> {
    if (!clientId) return null;
    return this.clientRepository.findOne({
      where: { clientId, active: true },
    });
  }

  async findActiveById(id: string): Promise<OidcClient | null> {
    return this.clientRepository.findOne({ where: { id, active: true } });
  }

  /** Returns the client when the id and secret match an active client. */
  async authenticate(
    clientId: string,
    clientSecret: string,
  ): Promise<OidcClient | null> {
    const client = await this.findActiveByClientId(clientId);
    if (!client || !clientSecret) return null;
    return verifySecret(clientSecret, client.secretSalt, client.secretHash)
      ? client
      : null;
  }
}
