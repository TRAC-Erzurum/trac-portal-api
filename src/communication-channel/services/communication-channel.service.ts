import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BranchCommunicationChannel } from '../entities/branch-communication-channel.entity';
import { CommunicationChannelTutorial } from '../entities/communication-channel-tutorial.entity';
import { RepeaterTalkgroup } from '../entities/repeater-talkgroup.entity';
import { CreateCommunicationChannelDto } from '../dto/create-communication-channel.dto';
import { UpdateCommunicationChannelDto } from '../dto/update-communication-channel.dto';
import { CommunicationChannelType } from '../enums/communication-channel-type.enum';
import { NetCommunicationChannel } from '../../net/entities/net-communication-channel.entity';
import { Net } from '../../net/entities/net.entity';

@Injectable()
export class CommunicationChannelService {
  constructor(
    @InjectRepository(BranchCommunicationChannel)
    private readonly communicationChannelRepository: Repository<BranchCommunicationChannel>,
    @InjectRepository(CommunicationChannelTutorial)
    private readonly tutorialRepository: Repository<CommunicationChannelTutorial>,
    @InjectRepository(RepeaterTalkgroup)
    private readonly talkgroupRepository: Repository<RepeaterTalkgroup>,
  ) {}

  async create(
    dto: CreateCommunicationChannelDto,
    createdBy: string,
  ): Promise<BranchCommunicationChannel> {
    const communicationChannel = new BranchCommunicationChannel();

    communicationChannel.branchId = dto.branchId;
    communicationChannel.type = dto.type;
    communicationChannel.repeaterMode = dto.repeaterMode;
    communicationChannel.name = dto.name;
    communicationChannel.description = dto.description;
    communicationChannel.isActive = dto.isActive ?? true;

    communicationChannel.location = dto.location;
    communicationChannel.district = dto.district;
    communicationChannel.latitude = dto.latitude;
    communicationChannel.longitude = dto.longitude;
    communicationChannel.altitude = dto.altitude;
    communicationChannel.coverage = dto.coverage;

    communicationChannel.rxFrequency = dto.rxFrequency;
    communicationChannel.txFrequency = dto.txFrequency;
    communicationChannel.offset = dto.offset;
    communicationChannel.txCtcssTone = dto.txCtcssTone;
    communicationChannel.rxCtcssTone = dto.rxCtcssTone;
    communicationChannel.txDcsCode = dto.txDcsCode;
    communicationChannel.txDcsPolarity = dto.txDcsPolarity;
    communicationChannel.rxDcsCode = dto.rxDcsCode;
    communicationChannel.rxDcsPolarity = dto.rxDcsPolarity;

    communicationChannel.echolinkNode = dto.echolinkNode;
    communicationChannel.echolinkName = dto.echolinkName;

    communicationChannel.aprsFrequency = dto.aprsFrequency;
    communicationChannel.aprsIsIgate = dto.aprsIsIgate;
    communicationChannel.aprsIsDigipeater = dto.aprsIsDigipeater;
    communicationChannel.aprsIgateMode = dto.aprsIgateMode;
    communicationChannel.aprsDigipeaterType = dto.aprsDigipeaterType;
    communicationChannel.aprsPath = dto.aprsPath;
    communicationChannel.aprsServer = dto.aprsServer;
    communicationChannel.digipeater = dto.digipeater;

    communicationChannel.hfFrequencyRange = dto.hfFrequencyRange;
    communicationChannel.hfMode = dto.hfMode;

    communicationChannel.dmrColorCode = dto.dmrColorCode;
    communicationChannel.dmrNetwork = dto.dmrNetwork;
    communicationChannel.dmrRepeaterId = dto.dmrRepeaterId;

    communicationChannel.createdBy = createdBy;
    communicationChannel.updatedBy = [];

    try {
      const saved = await this.communicationChannelRepository.save(
        communicationChannel,
      );

      if (dto.talkgroups?.length) {
        const talkgroups = dto.talkgroups.map((tg) => {
          const entity = new RepeaterTalkgroup();
          entity.communicationChannelId = saved.id;
          entity.talkgroupId = tg.talkgroupId;
          entity.talkgroupName = tg.talkgroupName;
          entity.timeslot = tg.timeslot;
          entity.isStatic = tg.isStatic ?? true;
          entity.createdBy = createdBy;
          entity.updatedBy = [];
          return entity;
        });
        saved.talkgroups = await this.talkgroupRepository.save(talkgroups);
      }

      return saved;
    } catch (error) {
      console.error('Communication channel save error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async findAll(
    options: {
      branchId?: string;
      type?: CommunicationChannelType;
      search?: string;
      includeInactive?: boolean;
      pageNumber?: number;
      pageSize?: number;
    } = {},
  ): Promise<{ data: BranchCommunicationChannel[]; total: number }> {
    const qb = this.communicationChannelRepository
      .createQueryBuilder('channel')
      .leftJoinAndSelect('channel.branch', 'branch')
      .leftJoinAndSelect('channel.talkgroups', 'talkgroup')
      .orderBy('channel.name', 'ASC');

    if (options.branchId) {
      qb.andWhere('channel.branchId = :branchId', {
        branchId: options.branchId,
      });
    }

    if (options.type) {
      qb.andWhere('channel.type = :type', { type: options.type });
    }

    if (!options.includeInactive) {
      qb.andWhere('channel.isActive = :isActive', { isActive: true });
    }

    if (options.search) {
      const searchTerm = `%${options.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(channel.name) LIKE :search OR LOWER(channel.description) LIKE :search OR LOWER(channel.location) LIKE :search)',
        { search: searchTerm },
      );
    }

    const total = await qb.getCount();

    if (options.pageNumber && options.pageSize) {
      qb.skip((options.pageNumber - 1) * options.pageSize).take(
        options.pageSize,
      );
    }

    const data = await qb.getMany();

    return { data, total };
  }

  async findByBranch(
    branchId: string,
    includeInactive: boolean = false,
    pageNumber?: number,
    pageSize?: number,
    search?: string,
    type?: string,
  ): Promise<{ data: BranchCommunicationChannel[]; total: number }> {
    return this.findAll({
      branchId,
      includeInactive,
      pageNumber,
      pageSize,
      search,
      type: type as CommunicationChannelType,
    });
  }

  async findOne(id: string): Promise<BranchCommunicationChannel> {
    const communicationChannel = await this.communicationChannelRepository
      .createQueryBuilder('channel')
      .leftJoinAndSelect('channel.branch', 'branch')
      .leftJoinAndSelect('channel.talkgroups', 'talkgroup')
      .where('channel.id = :id', { id })
      .getOne();

    if (!communicationChannel) {
      throw new NotFoundException('error.communicationChannelNotFound');
    }

    return communicationChannel;
  }

  async update(
    id: string,
    dto: UpdateCommunicationChannelDto,
    updatedBy: string,
  ): Promise<BranchCommunicationChannel> {
    const communicationChannel = await this.findOne(id);

    if (dto.type !== undefined) communicationChannel.type = dto.type;
    if (dto.repeaterMode !== undefined)
      communicationChannel.repeaterMode = dto.repeaterMode;
    if (dto.name !== undefined) communicationChannel.name = dto.name;
    if (dto.description !== undefined)
      communicationChannel.description = dto.description;
    if (dto.isActive !== undefined)
      communicationChannel.isActive = dto.isActive;

    if (dto.location !== undefined)
      communicationChannel.location = dto.location;
    if (dto.district !== undefined)
      communicationChannel.district = dto.district;
    if (dto.latitude !== undefined)
      communicationChannel.latitude = dto.latitude;
    if (dto.longitude !== undefined)
      communicationChannel.longitude = dto.longitude;
    if (dto.altitude !== undefined)
      communicationChannel.altitude = dto.altitude;
    if (dto.coverage !== undefined)
      communicationChannel.coverage = dto.coverage;

    if (dto.rxFrequency !== undefined)
      communicationChannel.rxFrequency = dto.rxFrequency;
    if (dto.txFrequency !== undefined)
      communicationChannel.txFrequency = dto.txFrequency;
    if (dto.offset !== undefined) communicationChannel.offset = dto.offset;
    if (dto.txCtcssTone !== undefined)
      communicationChannel.txCtcssTone = dto.txCtcssTone;
    if (dto.rxCtcssTone !== undefined)
      communicationChannel.rxCtcssTone = dto.rxCtcssTone;
    if (dto.txDcsCode !== undefined)
      communicationChannel.txDcsCode = dto.txDcsCode;
    if (dto.txDcsPolarity !== undefined)
      communicationChannel.txDcsPolarity = dto.txDcsPolarity;
    if (dto.rxDcsCode !== undefined)
      communicationChannel.rxDcsCode = dto.rxDcsCode;
    if (dto.rxDcsPolarity !== undefined)
      communicationChannel.rxDcsPolarity = dto.rxDcsPolarity;

    if (dto.echolinkNode !== undefined)
      communicationChannel.echolinkNode = dto.echolinkNode;
    if (dto.echolinkName !== undefined)
      communicationChannel.echolinkName = dto.echolinkName;

    if (dto.aprsFrequency !== undefined)
      communicationChannel.aprsFrequency = dto.aprsFrequency;
    if (dto.aprsIsIgate !== undefined)
      communicationChannel.aprsIsIgate = dto.aprsIsIgate;
    if (dto.aprsIsDigipeater !== undefined)
      communicationChannel.aprsIsDigipeater = dto.aprsIsDigipeater;
    if (dto.aprsIgateMode !== undefined)
      communicationChannel.aprsIgateMode = dto.aprsIgateMode;
    if (dto.aprsDigipeaterType !== undefined)
      communicationChannel.aprsDigipeaterType = dto.aprsDigipeaterType;
    if (dto.aprsPath !== undefined)
      communicationChannel.aprsPath = dto.aprsPath;
    if (dto.aprsServer !== undefined)
      communicationChannel.aprsServer = dto.aprsServer;
    if (dto.digipeater !== undefined)
      communicationChannel.digipeater = dto.digipeater;

    if (dto.hfFrequencyRange !== undefined)
      communicationChannel.hfFrequencyRange = dto.hfFrequencyRange;
    if (dto.hfMode !== undefined) communicationChannel.hfMode = dto.hfMode;

    if (dto.dmrColorCode !== undefined)
      communicationChannel.dmrColorCode = dto.dmrColorCode;
    if (dto.dmrNetwork !== undefined)
      communicationChannel.dmrNetwork = dto.dmrNetwork;
    if (dto.dmrRepeaterId !== undefined)
      communicationChannel.dmrRepeaterId = dto.dmrRepeaterId;

    communicationChannel.updatedBy = [
      ...(communicationChannel.updatedBy || []),
      updatedBy,
    ];

    try {
      const saved = await this.communicationChannelRepository.save(
        communicationChannel,
      );

      if (dto.talkgroups !== undefined) {
        // Remove existing talkgroups and replace with new ones
        await this.talkgroupRepository.delete({
          communicationChannelId: id,
        });

        if (dto.talkgroups.length > 0) {
          const talkgroups = dto.talkgroups.map((tg) => {
            const entity = new RepeaterTalkgroup();
            entity.communicationChannelId = id;
            entity.talkgroupId = tg.talkgroupId;
            entity.talkgroupName = tg.talkgroupName;
            entity.timeslot = tg.timeslot;
            entity.isStatic = tg.isStatic ?? true;
            entity.createdBy = updatedBy;
            entity.updatedBy = [];
            return entity;
          });
          saved.talkgroups = await this.talkgroupRepository.save(talkgroups);
        } else {
          saved.talkgroups = [];
        }
      }

      return saved;
    } catch (error) {
      console.error('Communication channel update error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async deactivate(
    id: string,
    updatedBy: string,
  ): Promise<BranchCommunicationChannel> {
    const communicationChannel = await this.findOne(id);

    // Check if communication channel is used in active nets
    const _netChannelRepository =
      this.communicationChannelRepository.manager.getRepository(
        NetCommunicationChannel,
      );
    const netRepository =
      this.communicationChannelRepository.manager.getRepository(Net);

    const activeNetsCount = await netRepository
      .createQueryBuilder('net')
      .innerJoin('net.communicationChannels', 'netChannel')
      .where('netChannel.communicationChannelId = :communicationChannelId', {
        communicationChannelId: id,
      })
      .andWhere('net.isActive = :isActive', { isActive: true })
      .andWhere('net.startedAt IS NOT NULL')
      .andWhere('net.endedAt IS NULL')
      .getCount();

    if (activeNetsCount > 0) {
      // Allow deactivation but warn (frontend should show warning)
      // We don't throw an error, but the response could include a warning
    }

    communicationChannel.isActive = false;
    communicationChannel.updatedBy = [
      ...(communicationChannel.updatedBy || []),
      updatedBy,
    ];

    try {
      return await this.communicationChannelRepository.save(
        communicationChannel,
      );
    } catch (error) {
      console.error('Communication channel deactivate error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async activate(
    id: string,
    updatedBy: string,
  ): Promise<BranchCommunicationChannel> {
    const communicationChannel = await this.findOne(id);

    communicationChannel.isActive = true;
    communicationChannel.updatedBy = [
      ...(communicationChannel.updatedBy || []),
      updatedBy,
    ];

    try {
      return await this.communicationChannelRepository.save(
        communicationChannel,
      );
    } catch (error) {
      console.error('Communication channel activate error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async delete(id: string): Promise<void> {
    const communicationChannel = await this.findOne(id);

    try {
      await this.communicationChannelRepository.remove(communicationChannel);
    } catch (error) {
      console.error('Communication channel delete error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async getTutorial(
    type: CommunicationChannelType,
    locale: string = 'tr',
  ): Promise<CommunicationChannelTutorial> {
    const tutorial = await this.tutorialRepository.findOne({
      where: { type, locale },
    });

    if (!tutorial) {
      const fallback = await this.tutorialRepository.findOne({
        where: { type, locale: 'en' },
      });

      if (!fallback) {
        throw new NotFoundException('error.tutorialNotFound');
      }

      return fallback;
    }

    return tutorial;
  }

  async getAllTutorials(
    locale: string = 'tr',
  ): Promise<CommunicationChannelTutorial[]> {
    return this.tutorialRepository.find({
      where: { locale },
      order: { type: 'ASC' },
    });
  }
}
