import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BranchInfrastructure } from '../entities/branch-infrastructure.entity';
import { InfrastructureTutorial } from '../entities/infrastructure-tutorial.entity';
import { CreateInfrastructureDto } from '../dto/create-infrastructure.dto';
import { UpdateInfrastructureDto } from '../dto/update-infrastructure.dto';
import { InfrastructureType } from '../enums/infrastructure-type.enum';

@Injectable()
export class InfrastructureService {
  constructor(
    @InjectRepository(BranchInfrastructure)
    private readonly infrastructureRepository: Repository<BranchInfrastructure>,
    @InjectRepository(InfrastructureTutorial)
    private readonly tutorialRepository: Repository<InfrastructureTutorial>,
  ) {}

  async create(
    dto: CreateInfrastructureDto,
    createdBy: string,
  ): Promise<BranchInfrastructure> {
    const infrastructure = new BranchInfrastructure();

    infrastructure.branchId = dto.branchId;
    infrastructure.type = dto.type;
    infrastructure.repeaterMode = dto.repeaterMode;
    infrastructure.name = dto.name;
    infrastructure.description = dto.description;
    infrastructure.isActive = dto.isActive ?? true;

    infrastructure.location = dto.location;
    infrastructure.latitude = dto.latitude;
    infrastructure.longitude = dto.longitude;
    infrastructure.altitude = dto.altitude;
    infrastructure.coverage = dto.coverage;

    infrastructure.rxFrequency = dto.rxFrequency;
    infrastructure.txFrequency = dto.txFrequency;
    infrastructure.offset = dto.offset;
    infrastructure.txCtcssTone = dto.txCtcssTone;
    infrastructure.rxCtcssTone = dto.rxCtcssTone;
    infrastructure.txDcsCode = dto.txDcsCode;
    infrastructure.txDcsPolarity = dto.txDcsPolarity;
    infrastructure.rxDcsCode = dto.rxDcsCode;
    infrastructure.rxDcsPolarity = dto.rxDcsPolarity;

    infrastructure.echolinkNode = dto.echolinkNode;
    infrastructure.echolinkName = dto.echolinkName;

    infrastructure.aprsFrequency = dto.aprsFrequency;
    infrastructure.aprsIsIgate = dto.aprsIsIgate;
    infrastructure.aprsIsDigipeater = dto.aprsIsDigipeater;
    infrastructure.aprsIgateMode = dto.aprsIgateMode;
    infrastructure.aprsDigipeaterType = dto.aprsDigipeaterType;
    infrastructure.aprsPath = dto.aprsPath;
    infrastructure.aprsServer = dto.aprsServer;
    infrastructure.digipeater = dto.digipeater;

    infrastructure.hfFrequencyRange = dto.hfFrequencyRange;
    infrastructure.hfMode = dto.hfMode;

    infrastructure.createdBy = createdBy;
    infrastructure.updatedBy = [];

    try {
      return await this.infrastructureRepository.save(infrastructure);
    } catch (error) {
      console.error('Infrastructure save error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async findAll(options: {
    branchId?: string;
    type?: InfrastructureType;
    search?: string;
    includeInactive?: boolean;
    pageNumber?: number;
    pageSize?: number;
  } = {}): Promise<{ data: BranchInfrastructure[]; total: number }> {
    const qb = this.infrastructureRepository
      .createQueryBuilder('infra')
      .leftJoinAndSelect('infra.branch', 'branch')
      .orderBy('infra.name', 'ASC');

    if (options.branchId) {
      qb.andWhere('infra.branchId = :branchId', { branchId: options.branchId });
    }

    if (options.type) {
      qb.andWhere('infra.type = :type', { type: options.type });
    }

    if (!options.includeInactive) {
      qb.andWhere('infra.isActive = :isActive', { isActive: true });
    }

    if (options.search) {
      const searchTerm = `%${options.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(infra.name) LIKE :search OR LOWER(infra.description) LIKE :search OR LOWER(infra.location) LIKE :search)',
        { search: searchTerm },
      );
    }

    const total = await qb.getCount();

    if (options.pageNumber && options.pageSize) {
      qb.skip((options.pageNumber - 1) * options.pageSize).take(options.pageSize);
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
  ): Promise<{ data: BranchInfrastructure[]; total: number }> {
    return this.findAll({ 
      branchId, 
      includeInactive, 
      pageNumber, 
      pageSize, 
      search, 
      type: type as InfrastructureType 
    });
  }

  async findOne(id: string): Promise<BranchInfrastructure> {
    const infrastructure = await this.infrastructureRepository
      .createQueryBuilder('infra')
      .leftJoinAndSelect('infra.branch', 'branch')
      .where('infra.id = :id', { id })
      .getOne();

    if (!infrastructure) {
      throw new NotFoundException('error.infrastructureNotFound');
    }

    return infrastructure;
  }

  async update(
    id: string,
    dto: UpdateInfrastructureDto,
    updatedBy: string,
  ): Promise<BranchInfrastructure> {
    const infrastructure = await this.findOne(id);

    if (dto.type !== undefined) infrastructure.type = dto.type;
    if (dto.repeaterMode !== undefined) infrastructure.repeaterMode = dto.repeaterMode;
    if (dto.name !== undefined) infrastructure.name = dto.name;
    if (dto.description !== undefined) infrastructure.description = dto.description;
    if (dto.isActive !== undefined) infrastructure.isActive = dto.isActive;

    if (dto.location !== undefined) infrastructure.location = dto.location;
    if (dto.latitude !== undefined) infrastructure.latitude = dto.latitude;
    if (dto.longitude !== undefined) infrastructure.longitude = dto.longitude;
    if (dto.altitude !== undefined) infrastructure.altitude = dto.altitude;
    if (dto.coverage !== undefined) infrastructure.coverage = dto.coverage;

    if (dto.rxFrequency !== undefined) infrastructure.rxFrequency = dto.rxFrequency;
    if (dto.txFrequency !== undefined) infrastructure.txFrequency = dto.txFrequency;
    if (dto.offset !== undefined) infrastructure.offset = dto.offset;
    if (dto.txCtcssTone !== undefined) infrastructure.txCtcssTone = dto.txCtcssTone;
    if (dto.rxCtcssTone !== undefined) infrastructure.rxCtcssTone = dto.rxCtcssTone;
    if (dto.txDcsCode !== undefined) infrastructure.txDcsCode = dto.txDcsCode;
    if (dto.txDcsPolarity !== undefined) infrastructure.txDcsPolarity = dto.txDcsPolarity;
    if (dto.rxDcsCode !== undefined) infrastructure.rxDcsCode = dto.rxDcsCode;
    if (dto.rxDcsPolarity !== undefined) infrastructure.rxDcsPolarity = dto.rxDcsPolarity;

    if (dto.echolinkNode !== undefined) infrastructure.echolinkNode = dto.echolinkNode;
    if (dto.echolinkName !== undefined) infrastructure.echolinkName = dto.echolinkName;

    if (dto.aprsFrequency !== undefined) infrastructure.aprsFrequency = dto.aprsFrequency;
    if (dto.aprsIsIgate !== undefined) infrastructure.aprsIsIgate = dto.aprsIsIgate;
    if (dto.aprsIsDigipeater !== undefined) infrastructure.aprsIsDigipeater = dto.aprsIsDigipeater;
    if (dto.aprsIgateMode !== undefined) infrastructure.aprsIgateMode = dto.aprsIgateMode;
    if (dto.aprsDigipeaterType !== undefined) infrastructure.aprsDigipeaterType = dto.aprsDigipeaterType;
    if (dto.aprsPath !== undefined) infrastructure.aprsPath = dto.aprsPath;
    if (dto.aprsServer !== undefined) infrastructure.aprsServer = dto.aprsServer;
    if (dto.digipeater !== undefined) infrastructure.digipeater = dto.digipeater;

    if (dto.hfFrequencyRange !== undefined) infrastructure.hfFrequencyRange = dto.hfFrequencyRange;
    if (dto.hfMode !== undefined) infrastructure.hfMode = dto.hfMode;

    infrastructure.updatedBy = [...(infrastructure.updatedBy || []), updatedBy];

    try {
      return await this.infrastructureRepository.save(infrastructure);
    } catch (error) {
      console.error('Infrastructure update error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async deactivate(
    id: string,
    updatedBy: string,
  ): Promise<BranchInfrastructure> {
    const infrastructure = await this.findOne(id);

    infrastructure.isActive = false;
    infrastructure.updatedBy = [...(infrastructure.updatedBy || []), updatedBy];

    try {
      return await this.infrastructureRepository.save(infrastructure);
    } catch (error) {
      console.error('Infrastructure deactivate error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async activate(
    id: string,
    updatedBy: string,
  ): Promise<BranchInfrastructure> {
    const infrastructure = await this.findOne(id);

    infrastructure.isActive = true;
    infrastructure.updatedBy = [...(infrastructure.updatedBy || []), updatedBy];

    try {
      return await this.infrastructureRepository.save(infrastructure);
    } catch (error) {
      console.error('Infrastructure activate error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async delete(id: string): Promise<void> {
    const infrastructure = await this.findOne(id);

    try {
      await this.infrastructureRepository.remove(infrastructure);
    } catch (error) {
      console.error('Infrastructure delete error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async getTutorial(
    type: InfrastructureType,
    locale: string = 'tr',
  ): Promise<InfrastructureTutorial> {
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

  async getAllTutorials(locale: string = 'tr'): Promise<InfrastructureTutorial[]> {
    return this.tutorialRepository.find({
      where: { locale },
      order: { type: 'ASC' },
    });
  }
}
