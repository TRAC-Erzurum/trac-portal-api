import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Attendee } from '../entities/attendee.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AttendeeDto } from '../dto/attendee.dto';
import { NetService } from './net.service';
import { OperatorService } from '../../operator/services/operator.service';
import { Operator } from '../../operator/entities/operator.entity';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import {
  ActivityEvent,
  ACTIVITY_EVENT,
} from '../../activity/events/activity.events';
import {
  ActivityType,
  EntityType,
} from '../../activity/enums/activity-type.enum';
import {
  isValidCallSignFormat,
  extractPlainCallSign,
} from '../../shared/utils/call-sign.util';

@Injectable()
export class AttendeeService {
  constructor(
    @InjectRepository(Attendee)
    private attendeeRepository: Repository<Attendee>,
    private netService: NetService,
    private operatorService: OperatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async addAttendeeToNet(
    netId: string,
    dto: AttendeeDto,
    createdBy: string,
    actorCallSign: string,
  ) {
    const net = await this.netService.findOne(netId);

    if (!net.startedAt) {
      throw new BadRequestException('error.netNotStarted');
    }

    const callSign = (dto.callSign ?? '').trim();
    if (!isValidCallSignFormat(callSign, { allowSlashes: true })) {
      throw new BadRequestException('error.callSignInvalid');
    }

    const exists = await this.attendeeRepository.findOne({
      where: { callSign, net: { id: netId } },
    });

    if (exists) {
      throw new ConflictException('Attendee already exists');
    }

    const operator = await this.getOrCreateOperator(
      {
        ...dto,
        callSign,
        name: (dto.name ?? '').trim() || undefined,
        country: (dto.country ?? '').trim() || undefined,
        city: (dto.city ?? '').trim() || undefined,
        district: (dto.district ?? '').trim() || undefined,
      },
      createdBy,
    );

    const attendee = new Attendee();
    attendee.callSign = callSign;
    attendee.name = (dto.name ?? '').trim() || operator.fullName || null;
    attendee.country = (dto.country ?? '').trim() || operator.country || null;
    attendee.city = (dto.city ?? '').trim() || operator.city || null;
    attendee.district = (dto.district ?? '').trim() || operator.district || null;
    attendee.readability = dto.readability;
    attendee.signalStrength = dto.signalStrength;
    attendee.operator = operator;
    attendee.net = net;
    attendee.createdBy = createdBy;
    attendee.updatedBy = [];

    const saved = await this.attendeeRepository.save(attendee);

    this.eventEmitter.emit(
      ACTIVITY_EVENT,
      new ActivityEvent(
        ActivityType.ATTENDEE_ADDED,
        EntityType.ATTENDEE,
        saved.id,
        null,
        actorCallSign,
        dto.callSign,
        { netId: net.id, netName: net.name },
      ),
    );

    return saved;
  }

  private async getOrCreateOperator(dto: AttendeeDto, createdBy: string) {
    let operator: Operator;
    if (!dto.operatorId) {
      const plainCallSign = extractPlainCallSign(dto.callSign ?? '');
      const existingOperator = await this.operatorService.findByCallSign(
        plainCallSign,
      );
      if (existingOperator) {
        operator = existingOperator;
      } else {
        operator = await this.operatorService.create(
          {
            callSign: plainCallSign,
            fullName: dto.name,
            country: (dto.country ?? '').trim() || undefined,
            city: (dto.city ?? '').trim() || undefined,
            district: (dto.district ?? '').trim() || undefined,
          },
          createdBy,
        );
      }
    } else {
      operator = await this.operatorService.findOne(dto.operatorId);
    }

    return operator;
  }

  async getAttendees(netId: string, pagination: PaginationDto) {
    return this.attendeeRepository.find({
      where: { net: { id: netId } },
      relations: { operator: { user: true }, net: true },
      order: { createdAt: pagination.sort },
    });
  }

  async updateAttendee(
    netId: string,
    attendeeId: string,
    dto: AttendeeDto,
    updatedBy: string,
  ) {
    const attendee = await this.attendeeRepository.findOne({
      where: { id: attendeeId },
      relations: { net: true },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    if (attendee.net.id !== netId) {
      throw new NotFoundException('Attendee not found in this net');
    }

    attendee.name =
      dto.name != null ? String(dto.name).trim() || null : attendee.name;
    if ('country' in dto) {
      attendee.country = String(dto.country ?? '').trim() || null;
    }
    if ('city' in dto) {
      attendee.city = String(dto.city ?? '').trim() || null;
    }
    if ('district' in dto) {
      attendee.district = String(dto.district ?? '').trim() || null;
    }
    attendee.readability = dto.readability ?? attendee.readability;
    attendee.signalStrength = dto.signalStrength ?? attendee.signalStrength;
    attendee.updatedBy = [...(attendee.updatedBy || []), updatedBy];

    return this.attendeeRepository.save(attendee);
  }

  async deleteAttendee(netId: string, attendeeId: string) {
    const attendee = await this.attendeeRepository.findOne({
      where: { id: attendeeId },
      relations: { net: true },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    if (attendee.net.id !== netId) {
      throw new NotFoundException('Attendee not found in this net');
    }

    return this.attendeeRepository.delete(attendeeId);
  }
}
