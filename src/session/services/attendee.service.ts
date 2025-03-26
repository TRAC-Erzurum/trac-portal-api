import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Attendee } from '../entities/attendee.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AttendeeDto } from '../dto/attendee.dto';
import { SessionService } from './session.service';
import { OperatorService } from '../../operator/services/operator.service';
import { Operator } from '../../operator/entities/operator.entity';
import { PaginationDto } from '../../shared/dto/pagination.dto';
@Injectable()
export class AttendeeService {
  constructor(
    @InjectRepository(Attendee)
    private attendeeRepository: Repository<Attendee>,
    private sessionService: SessionService,
    private operatorService: OperatorService,
  ) {}

  async addAttendeeToSession(sessionId: string, dto: AttendeeDto) {
    const session = await this.sessionService.findOne(sessionId);

    const exists = await this.attendeeRepository.findOne({
      where: { callSign: dto.callSign, session: { id: sessionId } },
    });

    if (exists) {
      throw new ConflictException('Attendee already exists');
    }

    const operator = await this.getOrCreateOperator(dto);

    const attendee = new Attendee();
    attendee.callSign = dto.callSign;
    attendee.name = dto.name;
    attendee.country = dto.country;
    attendee.city = dto.city;
    attendee.district = dto.district;
    attendee.readability = dto.readability;
    attendee.signalStrength = dto.signalStrength;
    attendee.operator = operator;

    attendee.session = session;
    return this.attendeeRepository.save(attendee);
  }

  private async getOrCreateOperator(dto: AttendeeDto) {
    let operator: Operator;
    if (!dto.operatorId) {
      let callSign: string;
      let prefix: string | undefined;
      let suffix: string | undefined;
      let country: string | undefined;
      let city: string | undefined;
      let district: string | undefined;

      const callSignParts = dto.callSign.split('/');

      if (callSignParts.length === 1) {
        callSign = callSignParts[0];
      } else if (callSignParts.length === 2) {
        callSign = callSignParts[0];
        prefix = callSignParts[1];
      } else if (callSignParts.length === 3) {
        callSign = callSignParts[0];
        prefix = callSignParts[1];
        suffix = callSignParts[2];
      } else {
        throw new BadRequestException('Invalid call sign');
      }

      if (dto.country) {
        country = dto.country;
      }

      if (dto.city) {
        city = dto.city;
      }

      if (dto.district) {
        district = dto.district;
      }

      operator = await this.operatorService.create({
        callSign,
        prefix,
        suffix,
        fullName: dto.name,
        country,
        city,
        district,
      });
    } else {
      operator = await this.operatorService.findOne(dto.operatorId);
    }

    return operator;
  }

  async getAttendees(sessionId: string, pagination: PaginationDto) {
    return this.attendeeRepository.find({
      where: { session: { id: sessionId } },
      relations: { operator: true, session: true },
      order: { createdAt: pagination.sort },
    });
  }

  async updateAttendee(
    sessionId: string,
    attendeeId: string,
    dto: AttendeeDto,
  ) {
    const attendee = await this.attendeeRepository.findOne({
      where: { id: attendeeId },
      relations: { session: true },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    if (attendee.session.id !== sessionId) {
      throw new NotFoundException('Attendee not found in this session');
    }

    const hasQth = dto.country || dto.city || dto.district;

    attendee.name = dto.name ?? attendee.name;
    attendee.country = hasQth ? dto.country : attendee.country;
    attendee.city = hasQth ? dto.city : attendee.city;
    attendee.district = hasQth ? dto.district : attendee.district;
    attendee.readability = dto.readability ?? attendee.readability;
    attendee.signalStrength = dto.signalStrength ?? attendee.signalStrength;

    return this.attendeeRepository.save(attendee);
  }

  async deleteAttendee(sessionId: string, attendeeId: string) {
    const attendee = await this.attendeeRepository.findOne({
      where: { id: attendeeId },
      relations: { session: true },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    if (attendee.session.id !== sessionId) {
      throw new NotFoundException('Attendee not found in this session');
    }

    return this.attendeeRepository.delete(attendeeId);
  }
}
