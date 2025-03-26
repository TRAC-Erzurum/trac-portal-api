import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Session } from '../entities/session.entity';
import { Repository } from 'typeorm';
import { CreateSessionDto } from '../dto/create-session.dto';
import { OperatorService } from '../../operator/services/operator.service';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly operatorService: OperatorService,
  ) {}

  async create(createSessionDto: CreateSessionDto) {
    const operator = await this.operatorService.findOne(
      createSessionDto.operatorId,
    );

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    const session = new Session();
    session.name = createSessionDto.name;
    session.frequency = createSessionDto.frequency;
    session.mode = createSessionDto.mode;
    session.type = createSessionDto.type;
    session.operator = operator;

    try {
      return await this.sessionRepository.save(session);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('error.alreadyExists');
      }
      console.error('Session save error:', error);
      throw new InternalServerErrorException('error.internal');
    }
  }

  async startSession(id: string) {
    const session = await this.findOne(id);

    session.startedAt = new Date();
    return this.sessionRepository.save(session);
  }

  async endSession(id: string) {
    const session = await this.findOne(id);
    session.endedAt = new Date();
    return this.sessionRepository.save(session);
  }

  async findOne(id: string) {
    const session = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .leftJoin('session.attendees', 'attendee')
      .addSelect('COUNT(DISTINCT attendee.id)', 'attendeeCount')
      .where('session.id = :id', { id })
      .groupBy('session.id')
      .addGroupBy('operator.id')
      .addGroupBy('user.id')
      .getRawAndEntities();

    if (!session.entities[0]) {
      throw new NotFoundException('Session not found');
    }

    return {
      ...session.entities[0],
      attendeeCount: Number(session.raw[0]?.attendeeCount || 0),
    };
  }

  async findAll() {
    const sessions = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .leftJoin('session.attendees', 'attendee')
      .addSelect('COUNT(DISTINCT attendee.id)', 'attendeeCount')
      .groupBy('session.id')
      .addGroupBy('operator.id')
      .addGroupBy('user.id')
      .orderBy('session.createdAt', 'DESC')
      .getRawAndEntities();

    return sessions.entities.map((session, index) => ({
      ...session,
      attendeeCount: Number(sessions.raw[index]?.attendeeCount || 0),
    }));
  }

  async restartSession(id: string) {
    const session = await this.findOne(id);
    session.endedAt = null;
    return this.sessionRepository.save(session);
  }

  async changeOperator(id: string, operatorId: string) {
    const session = await this.findOne(id);
    session.operator = await this.operatorService.findOne(operatorId);
    return this.sessionRepository.save(session);
  }
}
