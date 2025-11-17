import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Net } from '../entities/net.entity';
import { Repository } from 'typeorm';
import { CreateNetDto } from '../dto/create-net.dto';
import { OperatorService } from '../../operator/services/operator.service';
import { UpdateNetDto } from '../dto/update-net.dto';

@Injectable()
export class NetService {
  constructor(
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    private readonly operatorService: OperatorService,
  ) {}

  async create(createNetDto: CreateNetDto, createdBy: string) {
    const operator = await this.operatorService.findOne(
      createNetDto.operatorId,
    );

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    const net = new Net();
    net.name = createNetDto.name;
    net.frequency = createNetDto.frequency;
    net.mode = createNetDto.mode;
    net.type = createNetDto.type;
    net.operator = operator;
    net.createdBy = createdBy;
    net.updatedBy = [];

    try {
      return await this.netRepository.save(net);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('error.alreadyExists');
      }
      console.error('Net save error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async update(
    id: string,
    updateNetDto: UpdateNetDto,
    updatedBy: string,
  ) {
    const operator = await this.operatorService.findOne(
        updateNetDto.operatorId,
    );

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    const net = await this.findOne(id);
    net.name = updateNetDto.name;
    net.frequency = updateNetDto.frequency;
    net.mode = updateNetDto.mode;
    net.type = updateNetDto.type;
    net.operator = operator;
    net.startedAt = updateNetDto.startedAt;
    net.endedAt = updateNetDto.endedAt;
    net.updatedBy = [...(net.updatedBy || []), updatedBy];

    return this.netRepository.save(net);
  }

  async delete(id: string) {
    await this.netRepository.delete(id);
  }

  async startNet(id: string, updatedBy: string) {
    const net = await this.findOne(id);
    net.startedAt = new Date();
    net.updatedBy = [...(net.updatedBy || []), updatedBy];
    return this.netRepository.save(net);
  }

  async endNet(id: string, updatedBy: string) {
    const net = await this.findOne(id);
    net.endedAt = new Date();
    net.updatedBy = [...(net.updatedBy || []), updatedBy];
    return this.netRepository.save(net);
  }

  async findOne(id: string) {
    const net = await this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .leftJoin('net.attendees', 'attendee')
      .addSelect('COUNT(DISTINCT attendee.id)', 'attendeeCount')
      .where('net.id = :id', { id })
      .groupBy('net.id')
      .addGroupBy('operator.id')
      .addGroupBy('user.id')
      .getRawAndEntities();
    if (!net.entities[0]) {
      throw new NotFoundException('Net not found');
    }

    return {
      ...net.entities[0],
      attendeeCount: Number(net.raw[0]?.attendeeCount || 0),
    };
  }

  async findAll() {
    const nets = await this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .leftJoin('net.attendees', 'attendee')
      .addSelect('COUNT(DISTINCT attendee.id)', 'attendeeCount')
      .groupBy('net.id')
      .addGroupBy('operator.id')
      .addGroupBy('user.id')
      .orderBy('net.createdAt', 'DESC')
      .getRawAndEntities();
    return nets.entities.map((net, index) => ({
      ...net,
      attendeeCount: Number(nets.raw[index]?.attendeeCount || 0),
    }));
  }

  async restartNet(id: string, updatedBy: string) {
    const net = await this.findOne(id);
    net.endedAt = null;
    net.updatedBy = [...(net.updatedBy || []), updatedBy];
    return this.netRepository.save(net);
  }

  async changeOperator(id: string, operatorId: string, updatedBy: string) {
    const net = await this.findOne(id);
    net.operator = await this.operatorService.findOne(operatorId);
    net.updatedBy = [...(net.updatedBy || []), updatedBy];
    return this.netRepository.save(net);
  }
}
