import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Attendee } from '../entities/attendee.entity';
import { Net } from '../entities/net.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AttendeeDto } from '../dto/attendee.dto';
import { AttendeeImportDto } from '../dto/attendee-import.dto';
import { NetService } from './net.service';
import { OperatorService } from '../../operator/services/operator.service';
import { Operator } from '../../operator/entities/operator.entity';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { QthService } from '../../qth/services/qth.service';
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
import {
  normalizeImportCallSign,
  normalizeSignal,
  resolveCityDistrict,
} from '../utils/attendee-import.util';

export type AttendeeImportSkipReason =
  'invalidCallSign' | 'duplicate' | 'failed';

export interface AttendeeImportResult {
  added: number;
  skipped: Array<{
    row: number;
    callSign: string;
    reason: AttendeeImportSkipReason;
  }>;
}

/** Final attendee field values. Callers decide every fallback before persisting. */
export interface AttendeePersistInput {
  callSign: string;
  name: string | null;
  country: string | null;
  city: string | null;
  district: string | null;
  readability: number;
  signalStrength: number;
}

@Injectable()
export class AttendeeService {
  private readonly logger = new Logger(AttendeeService.name);

  constructor(
    @InjectRepository(Attendee)
    private attendeeRepository: Repository<Attendee>,
    private netService: NetService,
    private operatorService: OperatorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly qthService: QthService,
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

    // Manual add keeps the operator fallback for every empty field.
    return this.persistAttendee(
      net,
      operator,
      {
        callSign,
        name: (dto.name ?? '').trim() || operator.fullName || null,
        country: (dto.country ?? '').trim() || operator.country || null,
        city: (dto.city ?? '').trim() || operator.city || null,
        district: (dto.district ?? '').trim() || operator.district || null,
        readability: dto.readability,
        signalStrength: dto.signalStrength,
      },
      createdBy,
      actorCallSign,
      dto.callSign,
    );
  }

  async importAttendees(
    netId: string,
    dto: AttendeeImportDto,
    createdBy: string,
    actorCallSign: string,
  ): Promise<AttendeeImportResult> {
    const net = await this.netService.findOne(netId);

    if (!net.startedAt) {
      throw new BadRequestException('error.netNotStarted');
    }

    const existing = await this.attendeeRepository.find({
      where: { net: { id: netId } },
      select: { callSign: true },
    });
    const seen = new Set(
      existing.map((a) => normalizeImportCallSign(a.callSign)),
    );
    const cities = await this.qthService.getCities('Türkiye');

    const result: AttendeeImportResult = { added: 0, skipped: [] };

    for (const row of dto.rows) {
      const callSign = normalizeImportCallSign(row.callSign);

      if (!isValidCallSignFormat(callSign, { allowSlashes: true })) {
        result.skipped.push({
          row: row.row,
          callSign,
          reason: 'invalidCallSign',
        });
        continue;
      }

      if (seen.has(callSign)) {
        result.skipped.push({ row: row.row, callSign, reason: 'duplicate' });
        continue;
      }
      seen.add(callSign);

      try {
        // Import uses the resolved location only. No operator fallback for city/district.
        const location = resolveCityDistrict(
          { city: row.city?.trim(), district: row.district?.trim() },
          cities,
        );
        const signal = normalizeSignal(row.readability, row.signalStrength);
        const name = row.name?.trim() || undefined;

        const operator = await this.getOrCreateOperator(
          {
            callSign,
            name,
            city: location.city ?? undefined,
            district: location.district ?? undefined,
          },
          createdBy,
        );

        await this.persistAttendee(
          net,
          operator,
          {
            callSign,
            name: name || operator.fullName || null,
            country: operator.country || null,
            city: location.city,
            district: location.district,
            readability: signal.readability,
            signalStrength: signal.signalStrength,
          },
          createdBy,
          actorCallSign,
          callSign,
        );
        result.added += 1;
      } catch {
        this.logger.warn(
          `Attendee import failed at row ${row.row} (${callSign})`,
        );
        result.skipped.push({ row: row.row, callSign, reason: 'failed' });
      }
    }

    return result;
  }

  /** Shared by manual add and import. Callers validate the call sign, duplicates and every fallback. */
  private async persistAttendee(
    net: Net,
    operator: Operator,
    input: AttendeePersistInput,
    createdBy: string,
    actorCallSign: string,
    targetCallSign: string,
  ) {
    const attendee = new Attendee();
    attendee.callSign = input.callSign;
    attendee.name = input.name;
    attendee.country = input.country;
    attendee.city = input.city;
    attendee.district = input.district;
    attendee.readability = input.readability;
    attendee.signalStrength = input.signalStrength;
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
        targetCallSign,
        { netId: net.id, netName: net.name },
      ),
    );

    return saved;
  }

  private async getOrCreateOperator(
    dto: Partial<AttendeeDto>,
    createdBy: string,
  ) {
    let operator: Operator;
    if (!dto.operatorId) {
      const plainCallSign = extractPlainCallSign(dto.callSign ?? '');
      const existingOperator =
        await this.operatorService.findByCallSign(plainCallSign);
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
