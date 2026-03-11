import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { EquipmentStatus } from '../entities/equipment-status.entity';
import { Equipment } from '../entities/equipment.entity';
import {
  CreateEquipmentStatusDto,
  UpdateEquipmentStatusDto,
} from '../dto';

@Injectable()
export class EquipmentStatusService {
  constructor(
    @InjectRepository(EquipmentStatus)
    private readonly statusRepository: Repository<EquipmentStatus>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
  ) {}

  async findAll(): Promise<EquipmentStatus[]> {
    return this.statusRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findOne(id: string): Promise<EquipmentStatus> {
    const status = await this.statusRepository.findOne({ where: { id } });
    if (!status) {
      throw new NotFoundException('error.statusNotFound');
    }
    return status;
  }

  async create(
    dto: CreateEquipmentStatusDto,
    email: string,
  ): Promise<EquipmentStatus> {
    if (dto.isDefault) {
      await this.statusRepository.update(
        { isDefault: true },
        { isDefault: false },
      );
    }

    try {
      const status = this.statusRepository.create({
        name: dto.name,
        color: dto.color,
        sortOrder: dto.sortOrder ?? 0,
        isDefault: dto.isDefault ?? false,
        isActive: true,
        createdBy: email,
        updatedBy: [],
      });
      return await this.statusRepository.save(status);
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException('error.statusNameExists');
      }
      throw err;
    }
  }

  async update(
    id: string,
    dto: UpdateEquipmentStatusDto,
    email: string,
  ): Promise<EquipmentStatus> {
    const status = await this.findOne(id);

    if (dto.isDefault) {
      await this.statusRepository.update(
        { isDefault: true, id: Not(id) },
        { isDefault: false },
      );
    }

    if (dto.name !== undefined) status.name = dto.name;
    if (dto.color !== undefined) status.color = dto.color;
    if (dto.sortOrder !== undefined) status.sortOrder = dto.sortOrder;
    if (dto.isDefault !== undefined) status.isDefault = dto.isDefault;

    status.updatedBy = [...(status.updatedBy || []), email];

    try {
      return await this.statusRepository.save(status);
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException('error.statusNameExists');
      }
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    const status = await this.findOne(id);

    const equipmentCount = await this.equipmentRepository.count({
      where: { statusId: id },
    });
    if (equipmentCount > 0) {
      throw new BadRequestException('error.statusInUse');
    }

    await this.statusRepository.remove(status);
  }
}
