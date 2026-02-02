import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Net } from '../entities/net.entity';
import { Attendee } from '../entities/attendee.entity';
import { Repository } from 'typeorm';
import { CreateNetDto } from '../dto/create-net.dto';
import { OperatorService } from '../../operator/services/operator.service';
import { UpdateNetDto } from '../dto/update-net.dto';
import { ActivityEvent, ACTIVITY_EVENT } from '../../activity/events/activity.events';
import { ActivityType, EntityType } from '../../activity/enums/activity-type.enum';

@Injectable()
export class NetService {
  constructor(
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    @InjectRepository(Attendee)
    private readonly attendeeRepository: Repository<Attendee>,
    private readonly operatorService: OperatorService,
    private readonly eventEmitter: EventEmitter2,
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
      const saved = await this.netRepository.save(net);
      this.eventEmitter.emit(
        ACTIVITY_EVENT,
        new ActivityEvent(
          ActivityType.NET_CREATED,
          EntityType.NET,
          saved.id,
          null,
          operator.callSign,
          null,
          { netName: saved.name, frequency: saved.frequency, mode: saved.mode },
        ),
      );
      return saved;
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

  async startNet(id: string, updatedBy: string, addOperatorAsAttendee: boolean = false) {
    const net = await this.findOne(id);
    net.startedAt = new Date();
    net.updatedBy = [...(net.updatedBy || []), updatedBy];
    const savedNet = await this.netRepository.save(net);

    this.eventEmitter.emit(
      ACTIVITY_EVENT,
      new ActivityEvent(
        ActivityType.NET_STARTED,
        EntityType.NET,
        savedNet.id,
        null,
        net.operator?.callSign || null,
        null,
        { netName: net.name, frequency: net.frequency },
      ),
    );

    if (addOperatorAsAttendee && net.operator) {
      const existingAttendee = await this.attendeeRepository.findOne({
        where: { callSign: net.operator.callSign, net: { id } },
      });

      if (!existingAttendee) {
        const attendee = new Attendee();
        attendee.callSign = net.operator.callSign;
        attendee.name = net.operator.fullName;
        attendee.country = net.operator.country;
        attendee.city = net.operator.city;
        attendee.district = net.operator.district;
        attendee.operator = net.operator;
        attendee.net = savedNet;
        attendee.createdBy = updatedBy;
        attendee.updatedBy = [];
        await this.attendeeRepository.save(attendee);
      }
    }

    return this.findOne(id);
  }

  async endNet(id: string, updatedBy: string) {
    const net = await this.findOne(id);
    net.endedAt = new Date();
    net.updatedBy = [...(net.updatedBy || []), updatedBy];
    const saved = await this.netRepository.save(net);

    this.eventEmitter.emit(
      ACTIVITY_EVENT,
      new ActivityEvent(
        ActivityType.NET_ENDED,
        EntityType.NET,
        saved.id,
        null,
        net.operator?.callSign || null,
        null,
        { netName: net.name, attendeeCount: net.attendeeCount },
      ),
    );

    return saved;
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

  async findAll(query: {
    search?: string;
    status?: 'all' | 'active' | 'pending' | 'completed';
    dateFilter?: 'all' | 'week' | 'month' | '3months';
    limit?: number;
    offset?: number;
  } = {}) {
    const { search, status = 'all', dateFilter = 'all', limit = 50, offset = 0 } = query;

    const qb = this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .leftJoin('net.attendees', 'attendee')
      .addSelect('COUNT(DISTINCT attendee.id)', 'attendeeCount')
      .groupBy('net.id')
      .addGroupBy('operator.id')
      .addGroupBy('user.id');

    if (search) {
      const searchTerm = `%${search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(net.name) LIKE :search OR LOWER(operator.callSign) LIKE :search)',
        { search: searchTerm },
      );
    }

    if (status !== 'all') {
      if (status === 'active') {
        qb.andWhere('net.startedAt IS NOT NULL AND net.endedAt IS NULL');
      } else if (status === 'pending') {
        qb.andWhere('net.startedAt IS NULL');
      } else if (status === 'completed') {
        qb.andWhere('net.endedAt IS NOT NULL');
      }
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoff: Date;
      if (dateFilter === 'week') {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateFilter === 'month') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }
      qb.andWhere('COALESCE(net.startedAt, net.createdAt) >= :cutoff', { cutoff });
    }

    qb.orderBy(
      `CASE 
        WHEN net.startedAt IS NOT NULL AND net.endedAt IS NULL THEN 0 
        WHEN net.startedAt IS NULL THEN 1 
        ELSE 2 
      END`,
      'ASC',
    );
    qb.addOrderBy('net.createdAt', 'DESC');

    const countQb = qb.clone();
    const total = await countQb.getCount();

    qb.limit(Math.min(limit, 100));
    qb.offset(offset);

    const nets = await qb.getRawAndEntities();

    return {
      data: nets.entities.map((net, index) => ({
        ...net,
        attendeeCount: Number(nets.raw[index]?.attendeeCount || 0),
      })),
      total,
      limit,
      offset,
    };
  }

  async restartNet(id: string, updatedBy: string) {
    const net = await this.findOne(id);
    net.endedAt = null;
    net.updatedBy = [...(net.updatedBy || []), updatedBy];
    return this.netRepository.save(net);
  }

  async changeOperator(id: string, operatorId: string, updatedBy: string, isSuperAdmin: boolean = false) {
    const net = await this.findOne(id);

    if (net.startedAt && !isSuperAdmin) {
      throw new ForbiddenException('error.operatorChangeNotAllowed');
    }

    net.operator = await this.operatorService.findOne(operatorId);
    net.updatedBy = [...(net.updatedBy || []), updatedBy];
    return this.netRepository.save(net);
  }
}
