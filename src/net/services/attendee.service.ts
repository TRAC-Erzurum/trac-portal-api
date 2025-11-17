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
import { NetService } from './net.service';
import { OperatorService } from '../../operator/services/operator.service';
import { Operator } from '../../operator/entities/operator.entity';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@Injectable()
export class AttendeeService {
  constructor(
    @InjectRepository(Attendee)
    private attendeeRepository: Repository<Attendee>,
    private netService: NetService,
    private operatorService: OperatorService,
  ) {}

  async addAttendeeToNet(
      netId: string,
    dto: AttendeeDto,
    createdBy: string,
  ) {
    const net = await this.netService.findOne(netId);

    const exists = await this.attendeeRepository.findOne({
      where: { callSign: dto.callSign, net: { id: netId } },
    });

    if (exists) {
      throw new ConflictException('Attendee already exists');
    }

    const operator = await this.getOrCreateOperator(dto, createdBy);

    const attendee = new Attendee();
    attendee.callSign = dto.callSign;
    attendee.name = dto.name;
    attendee.country = dto.country;
    attendee.city = dto.city;
    attendee.district = dto.district;
    attendee.readability = dto.readability;
    attendee.signalStrength = dto.signalStrength;
    attendee.operator = operator;
    attendee.net = net;
    attendee.createdBy = createdBy;
    attendee.updatedBy = [];

    return this.attendeeRepository.save(attendee);
  }

  private async getOrCreateOperator(dto: AttendeeDto, createdBy: string) {
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
        if (callSignParts[1]?.length === 1) {
          callSign = callSignParts[0];
          suffix = callSignParts[1];
        } else {
          prefix = callSignParts[0];
          callSign = callSignParts[1];
        }
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

      operator = await this.operatorService.create(
        {
          callSign,
          prefix,
          suffix,
          fullName: dto.name,
          country,
          city,
          district,
        },
        createdBy,
      );
    } else {
      operator = await this.operatorService.findOne(dto.operatorId);
    }

    return operator;
  }

  async getAttendees(netId: string, pagination: PaginationDto) {
    return this.attendeeRepository.find({
      where: { net: { id: netId } },
      relations: { operator: true, net: true },
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

    const hasQth = dto.country || dto.city || dto.district;

    attendee.name = dto.name ?? attendee.name;
    attendee.country = hasQth ? dto.country : attendee.country;
    attendee.city = hasQth ? dto.city : attendee.city;
    attendee.district = hasQth ? dto.district : attendee.district;
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
