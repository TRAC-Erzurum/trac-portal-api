import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePublishTargetDto } from '../dto/create-publish-target.dto';
import { UpdatePublishTargetDto } from '../dto/update-publish-target.dto';
import { PublishTarget } from '../entities/publish-target.entity';
import { isAcceptableIntakeUrl } from '../utils/intake-url.util';

/** A target as the API shows it. The shared secret is write-only and never part of it. */
export interface PublishTargetView {
  id: string;
  name: string;
  intakeUrl: string;
  sourceId: string;
  active: boolean;
  /** The target answered 401; its rows are held until its credentials change. */
  authFailing: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PublishTargetService {
  constructor(
    @InjectRepository(PublishTarget)
    private readonly targetRepository: Repository<PublishTarget>,
  ) {}

  toView(target: PublishTarget): PublishTargetView {
    return {
      id: target.id,
      name: target.name,
      intakeUrl: target.intakeUrl,
      sourceId: target.sourceId,
      active: target.active,
      authFailing: !!target.authFailedAt,
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
    };
  }

  async list(): Promise<PublishTargetView[]> {
    const targets = await this.targetRepository.find({
      order: { createdAt: 'ASC' },
    });
    return targets.map((t) => this.toView(t));
  }

  async findById(id: string): Promise<PublishTarget | null> {
    return this.targetRepository.findOne({ where: { id } });
  }

  async create(
    dto: CreatePublishTargetDto,
    actorEmail: string,
  ): Promise<PublishTargetView> {
    const name = dto.name.trim();
    const intakeUrl = dto.intakeUrl.trim();
    const sourceId = dto.sourceId.trim();
    if (!name) throw new BadRequestException('error.publishTargetNameRequired');
    if (!sourceId) throw new BadRequestException('error.invalidData');
    if (!isAcceptableIntakeUrl(intakeUrl)) {
      throw new BadRequestException('error.publishTargetUrlInvalid');
    }
    const saved = await this.targetRepository.save(
      this.targetRepository.create({
        name,
        intakeUrl,
        sourceId,
        sharedSecret: dto.sharedSecret,
        active: true,
        authFailedAt: null,
        createdBy: actorEmail,
        updatedBy: [],
      }),
    );
    return this.toView(saved);
  }

  async update(
    id: string,
    dto: UpdatePublishTargetDto,
    actorEmail: string,
  ): Promise<PublishTargetView> {
    const target = await this.findById(id);
    if (!target) throw new NotFoundException('error.publishTargetNotFound');

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name)
        throw new BadRequestException('error.publishTargetNameRequired');
      target.name = name;
    }
    // Any credential change (where, as whom, with which key) ends a 401 hold:
    // a wrong source id or URL fails authentication just like a wrong secret.
    let credentialsChanged = false;
    if (dto.intakeUrl !== undefined) {
      const intakeUrl = dto.intakeUrl.trim();
      if (!isAcceptableIntakeUrl(intakeUrl)) {
        throw new BadRequestException('error.publishTargetUrlInvalid');
      }
      credentialsChanged ||= intakeUrl !== target.intakeUrl;
      target.intakeUrl = intakeUrl;
    }
    if (dto.sourceId !== undefined) {
      const sourceId = dto.sourceId.trim();
      if (!sourceId) throw new BadRequestException('error.invalidData');
      credentialsChanged ||= sourceId !== target.sourceId;
      target.sourceId = sourceId;
    }
    if (dto.sharedSecret !== undefined) {
      credentialsChanged = true;
      target.sharedSecret = dto.sharedSecret;
    }
    if (credentialsChanged) target.authFailedAt = null;
    if (dto.active !== undefined) target.active = dto.active;
    target.updatedBy = [...(target.updatedBy ?? []), actorEmail];

    return this.toView(await this.targetRepository.save(target));
  }
}
