import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Net } from '../../net/entities/net.entity';
import { NetScheduler } from '../entities/net-scheduler.entity';
import { NetSchedulerCommunicationChannel } from '../entities/net-scheduler-communication-channel.entity';
import { NetRecurrence } from '../enums/net-recurrence.enum';
import { CreateNetSchedulerDto } from '../dto/create-net-scheduler.dto';
import { UpdateNetSchedulerDto } from '../dto/update-net-scheduler.dto';
import { NetService } from '../../net/services/net.service';
import { BranchService } from '../../branch/services/branch.service';
import { OperatorService } from '../../operator/services/operator.service';
import { CertificateTemplateService } from '../../certificate-template/certificate-template.service';
import { UserService } from '../../user/services/user.service';
import { MembershipService } from '../../branch/services/membership.service';
import { GlobalRole, BranchRole } from '../../auth/enums/role.enum';
import { CreateNetDto } from '../../net/dto/create-net.dto';
import { NetCommunicationChannelDto } from '../../net/dto/net-communication-channel.dto';
import { normalizeTurkishSearchTerm } from '../../shared/utils/turkish-search.util';

/** Today in GMT+3 (Europe/Istanbul) as YYYY-MM-DD. Use for "today" in create/update/list/upcoming. */
function getTodayGMT3(): string {
  const now = new Date();
  const gmt3 = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const y = gmt3.getFullYear();
  const m = String(gmt3.getMonth() + 1).padStart(2, '0');
  const d = String(gmt3.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Last day of month for monthly recurrence when day doesn't exist (e.g. 31 → 28 in Feb). */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Format dateStr (YYYY-MM-DD) as YYYY-MM-DD for date_iso. */
function toDateParts(dateStr: string): {
  year: number;
  month: number;
  day: number;
  date: Date;
} {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return { year: y, month: m, day: d, date };
}

@Injectable()
export class NetSchedulerService {
  constructor(
    @InjectRepository(NetScheduler)
    private readonly schedulerRepository: Repository<NetScheduler>,
    @InjectRepository(NetSchedulerCommunicationChannel)
    private readonly channelRepository: Repository<NetSchedulerCommunicationChannel>,
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    private readonly netService: NetService,
    private readonly branchService: BranchService,
    private readonly operatorService: OperatorService,
    private readonly userService: UserService,
    private readonly membershipService: MembershipService,
    private readonly certificateTemplateService: CertificateTemplateService,
  ) {}

  /** Resolve name template with placeholders. dateStr: YYYY-MM-DD; locale e.g. 'tr' or 'en'. */
  resolveNameTemplate(
    scheduler: NetScheduler,
    dateStr: string,
    locale: string = 'tr',
  ): string {
    const { year, month, day, date } = toDateParts(dateStr);
    const branchName = scheduler.branch?.name ?? '';
    const branchCallsign =
      scheduler.branchCallSign?.callSign ?? scheduler.branchCallSignId ?? '';
    const operatorCallsign = scheduler.operator?.callSign ?? '';
    const operatorName = scheduler.operator?.fullName ?? '';
    const time =
      scheduler.scheduledTime?.slice(0, 5) ?? '20:00'; // HH:mm
    const monthNamesTr = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
    ];
    const dayNamesTr = [
      'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi',
    ];
    const monthNamesEn = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const dayNamesEn = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ];
    const monthNames = locale === 'en' ? monthNamesEn : monthNamesTr;
    const dayNames = locale === 'en' ? dayNamesEn : dayNamesTr;

    const dayPadded = String(day).padStart(2, '0');
    const monthName = monthNames[month - 1];
    const dayOfWeek = dayNames[date.getDay()];

    const map: Record<string, string> = {
      '{{branch_name}}': branchName,
      '{{branch_callsign}}': branchCallsign,
      '{{day}}': dayPadded,
      '{{month}}': monthName,
      '{{year}}': String(year),
      '{{day_of_week}}': dayOfWeek,
      '{{time}}': time,
      '{{operator_callsign}}': operatorCallsign,
      '{{operator_name}}': operatorName,
    };

    let out = scheduler.name;
    for (const [key, value] of Object.entries(map)) {
      out = out.split(key).join(value);
    }
    return out.replace(/\{\{[^}]+\}\}/g, '').trim() || scheduler.name;
  }

  /** Whether this scheduler should produce a net on dateStr (YYYY-MM-DD). */
  dateFallsInRecurrence(scheduler: NetScheduler, dateStr: string): boolean {
    const [y, m, d] = dateStr.split('-').map(Number);
    const start = scheduler.startDate;
    if (dateStr < start) return false;
    if (scheduler.endDate != null && dateStr > scheduler.endDate) return false;

    switch (scheduler.recurrence) {
      case NetRecurrence.ONE_TIME:
        return dateStr === start;
      case NetRecurrence.DAILY:
        return true;
      case NetRecurrence.WEEKLY: {
        const startDate = new Date(start + 'T12:00:00Z');
        const checkDate = new Date(dateStr + 'T12:00:00Z');
        return startDate.getDay() === checkDate.getDay();
      }
      case NetRecurrence.MONTHLY: {
        const startDay = new Date(start + 'T12:00:00Z').getDate();
        const lastDay = getLastDayOfMonth(y, m);
        const targetDay = Math.min(startDay, lastDay);
        return d === targetDay;
      }
      default:
        return false;
    }
  }

  /** Next N occurrence dates (YYYY-MM-DD) after afterDateStr that don't have a net yet. */
  async getNextOccurrenceDates(
    scheduler: NetScheduler,
    afterDateStr: string,
    limit: number,
  ): Promise<string[]> {
    const result: string[] = [];
    let current = new Date(afterDateStr + 'T12:00:00Z');
    const maxIter = 400;
    let iter = 0;

    while (result.length < limit && iter++ < maxIter) {
      current.setDate(current.getDate() + 1);
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      if (!this.dateFallsInRecurrence(scheduler, dateStr)) continue;

      const exists = await this.netService.existsBySchedulerIdAndDate(
        scheduler.id,
        dateStr,
      );
      if (!exists) {
        result.push(dateStr);
      }
    }
    return result;
  }

  /** Create a single net for this scheduler on dateStr if recurrence matches and no net exists. */
  async createNetsForSchedulerForDate(
    scheduler: NetScheduler,
    dateStr: string,
    locale: string = 'tr',
  ) {
    if (!scheduler.isActive) return null;
    if (!this.dateFallsInRecurrence(scheduler, dateStr)) return null;

    const exists = await this.netService.existsBySchedulerIdAndDate(
      scheduler.id,
      dateStr,
    );
    if (exists) return null;

    const name = this.resolveNameTemplate(scheduler, dateStr, locale);
    let finalName = name;
    let suffix = 1;
    while (await this.netService.nameExists(finalName)) {
      finalName = `${name} – ${++suffix}`;
    }

    const scheduledAt = new Date(`${dateStr}T${scheduler.scheduledTime.slice(0, 5)}:00+03:00`);
    const channels: NetCommunicationChannelDto[] =
      scheduler.communicationChannels?.map((ch) => ({
        communicationChannelId: ch.communicationChannelId ?? undefined,
        isSimplexAdHoc: ch.isSimplexAdHoc,
        simplexFrequency: ch.simplexFrequency ?? undefined,
      })) ?? [];

    if (channels.length === 0) return null;

    const createNetDto: CreateNetDto = {
      name: finalName,
      operatorId: scheduler.operatorId,
      branchId: scheduler.branchId,
      branchCallSignId: scheduler.branchCallSignId ?? undefined,
      communicationChannels: channels,
      scheduledAt: scheduledAt.toISOString(),
      estimatedDurationMinutes: scheduler.estimatedDurationMinutes ?? 30,
      schedulerId: scheduler.id,
      certificateTemplateId: scheduler.certificateTemplateId ?? undefined,
    };

    const createdBy = scheduler.createdBy ?? 'system';
    const actorCallSign = scheduler.operator?.callSign ?? '';

    return this.netService.createFromScheduler(
      createNetDto,
      createdBy,
      actorCallSign,
    );
  }

  /** Ensure nets for this scheduler for the given date (e.g. after create/update for today). */
  async ensureNetsForSchedulerForDate(
    scheduler: NetScheduler,
    dateStr: string,
    locale?: string,
  ) {
    return this.createNetsForSchedulerForDate(scheduler, dateStr, locale);
  }

  async create(
    dto: CreateNetSchedulerDto,
    createdBy: string,
    userId: string,
  ): Promise<NetScheduler> {
    const startDate = dto.startDate.slice(0, 10);
    if (dto.recurrence !== NetRecurrence.ONE_TIME) {
      const today = getTodayGMT3();
      if (startDate < today) {
        throw new BadRequestException('error.schedulerStartDateNotInPast');
      }
    }

    const branch = await this.branchService.findOne(dto.branchId);
    if (!branch?.isActive) {
      throw new BadRequestException('error.branchInactive');
    }

    const effectiveRole = await this.userService.getEffectiveRole(userId);
    if (effectiveRole !== GlobalRole.SUPER_ADMIN) {
      await this.userService.validateBranchMembership(userId, dto.branchId);
    }

    const operator = await this.operatorService.findOne(dto.operatorId);
    if (!operator) {
      throw new NotFoundException('error.notFound');
    }

    if (
      !dto.communicationChannels?.length ||
      (!dto.communicationChannels.some((c) => c.communicationChannelId) &&
        !dto.communicationChannels.some((c) => c.isSimplexAdHoc && c.simplexFrequency))
    ) {
      throw new BadRequestException(
        'error.atLeastOneCommunicationChannelRequired',
      );
    }

    if (dto.branchCallSignId !== undefined) {
      if (dto.branchCallSignId) {
        const callSign = branch.callSigns?.find(
          (cs) => cs.id === dto.branchCallSignId,
        );
        if (!callSign) {
          throw new BadRequestException('error.callSignNotInBranch');
        }
      }
    }

    if (dto.certificateTemplateId) {
      await this.certificateTemplateService.findOne(
        dto.certificateTemplateId,
        dto.branchId,
      );
    }

    const scheduler = this.schedulerRepository.create({
      name: dto.name,
      branchId: dto.branchId,
      operatorId: dto.operatorId,
      startDate,
      recurrence: dto.recurrence,
      endDate: dto.endDate?.slice(0, 10) ?? null,
      scheduledTime: (dto.scheduledTime ?? '20:00') + ':00',
      estimatedDurationMinutes: dto.estimatedDurationMinutes ?? 30,
      certificateTemplateId: dto.certificateTemplateId ?? null,
      isActive: true,
      createdBy,
      updatedBy: [],
    });

    if (dto.branchCallSignId !== undefined) {
      scheduler.branchCallSignId = dto.branchCallSignId ?? null;
      scheduler.branchCallSign =
        dto.branchCallSignId != null
          ? branch.callSigns?.find((cs) => cs.id === dto.branchCallSignId) ?? null
          : null;
    }

    const saved = await this.schedulerRepository.save(scheduler);

    const channelEntities = dto.communicationChannels.map((ch) => {
      const e = this.channelRepository.create({
        schedulerId: saved.id,
        communicationChannelId: ch.communicationChannelId ?? null,
        isSimplexAdHoc: ch.isSimplexAdHoc ?? false,
        simplexFrequency: ch.simplexFrequency ?? null,
        createdBy,
        updatedBy: [],
      });
      return e;
    });
    await this.channelRepository.save(channelEntities);

    const withRelations = await this.findOne(saved.id);

    const today = getTodayGMT3();
    if (dto.recurrence === NetRecurrence.ONE_TIME && startDate <= today) {
      await this.ensureNetsForSchedulerForDate(withRelations, startDate);
    } else if (startDate === today) {
      await this.ensureNetsForSchedulerForDate(withRelations, today);
    }

    return this.findOne(saved.id);
  }

  async update(
    id: string,
    dto: UpdateNetSchedulerDto,
    updatedBy: string,
    userId: string,
  ): Promise<NetScheduler> {
    if ((dto as Record<string, unknown>).startDate !== undefined) {
      throw new BadRequestException('error.schedulerStartDateImmutable');
    }
    const scheduler = await this.findOne(id);
    const effectiveRole = await this.userService.getEffectiveRole(userId);
    if (effectiveRole !== GlobalRole.SUPER_ADMIN) {
      await this.userService.validateBranchMembership(userId, scheduler.branchId);
    }

    if (dto.name != null) scheduler.name = dto.name;
    if (dto.operatorId != null) {
      const operator = await this.operatorService.findOne(dto.operatorId);
      if (!operator) throw new NotFoundException('error.notFound');
      scheduler.operatorId = dto.operatorId;
      scheduler.operator = operator;
    }
    if (dto.branchId != null) {
      const branch = await this.branchService.findOne(dto.branchId);
      if (!branch?.isActive) throw new BadRequestException('error.branchInactive');
      scheduler.branchId = dto.branchId;
      scheduler.branch = branch;
    }
    if (dto.branchCallSignId !== undefined) {
      if (dto.branchCallSignId) {
        const branch = await this.branchService.findOne(scheduler.branchId);
        const callSign = branch.callSigns?.find(
          (cs) => cs.id === dto.branchCallSignId,
        );
        if (!callSign) {
          throw new BadRequestException('error.callSignNotInBranch');
        }
        scheduler.branchCallSignId = callSign.id;
        scheduler.branchCallSign = callSign;
      } else {
        scheduler.branchCallSignId = null;
        scheduler.branchCallSign = null;
      }
    }
    if (dto.recurrence != null) scheduler.recurrence = dto.recurrence;
    if (dto.endDate !== undefined) scheduler.endDate = dto.endDate?.slice(0, 10) ?? null;
    if (dto.scheduledTime != null)
      scheduler.scheduledTime = dto.scheduledTime.includes(':')
        ? dto.scheduledTime
        : dto.scheduledTime + ':00';
    if (dto.estimatedDurationMinutes != null)
      scheduler.estimatedDurationMinutes = dto.estimatedDurationMinutes;
    if (dto.isActive !== undefined) scheduler.isActive = dto.isActive;
    if (dto.certificateTemplateId !== undefined) {
      if (dto.certificateTemplateId) {
        await this.certificateTemplateService.findOne(
          dto.certificateTemplateId,
          scheduler.branchId,
        );
        scheduler.certificateTemplateId = dto.certificateTemplateId;
      } else {
        scheduler.certificateTemplateId = null;
      }
    }

    scheduler.updatedBy = [...(scheduler.updatedBy || []), updatedBy];

    await this.schedulerRepository.save(scheduler);

    if (dto.communicationChannels != null) {
      await this.channelRepository.delete({ schedulerId: id });
      const channelEntities = dto.communicationChannels.map((ch) =>
        this.channelRepository.create({
          schedulerId: id,
          communicationChannelId: ch.communicationChannelId ?? null,
          isSimplexAdHoc: ch.isSimplexAdHoc ?? false,
          simplexFrequency: ch.simplexFrequency ?? null,
          createdBy: updatedBy,
          updatedBy: [],
        }),
      );
      await this.channelRepository.save(channelEntities);
    }

    const updated = await this.findOne(id);
    const today = getTodayGMT3();
    await this.ensureNetsForSchedulerForDate(updated, today);
    return this.findOne(id);
  }

  async findOne(id: string): Promise<NetScheduler> {
    const scheduler = await this.schedulerRepository.findOne({
      where: { id },
      relations: ['branch', 'operator', 'branchCallSign', 'communicationChannels', 'communicationChannels.communicationChannel'],
    });
    if (!scheduler) {
      throw new NotFoundException('error.notFound');
    }
    return scheduler;
  }

  async findAll(
    opts: {
      branchId?: string;
      branchFilter?: 'all' | 'my-branches' | 'branch';
      userId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<
    | NetScheduler[]
    | { data: NetScheduler[]; total: number; limit: number; offset: number }
  > {
    const { branchId, branchFilter = 'my-branches', userId, search, limit, offset } = opts;
    const usePagination =
      limit !== undefined || offset !== undefined;
    const limitNum = Math.min(limit ?? 50, 100);
    const offsetNum = offset ?? 0;

    const qb = this.schedulerRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.branch', 'branch')
      .leftJoinAndSelect('s.operator', 'operator')
      .leftJoinAndSelect('s.branchCallSign', 'branchCallSign')
      .leftJoinAndSelect('s.communicationChannels', 'ch')
      .orderBy('s.startDate', 'DESC');

    if (branchId) {
      qb.andWhere('s.branchId = :branchId', { branchId });
    } else if (branchFilter === 'my-branches' && userId) {
      const role = await this.userService.getEffectiveRole(userId);
      if (role !== GlobalRole.SUPER_ADMIN) {
        const branches = await this.membershipService.getUserBranches(userId);
        const ids = branches.map((b) => b.branchId);
        if (ids.length) qb.andWhere('s.branchId IN (:...ids)', { ids });
        else qb.andWhere('1 = 0');
      }
    }

    if (search?.trim()) {
      const searchTerm = normalizeTurkishSearchTerm(search);
      qb.andWhere(
        '(LOWER(s.name) LIKE :search OR LOWER(branch.name) LIKE :search OR LOWER(operator.callSign) LIKE :search)',
        { search: searchTerm },
      );
    }

    const list = await qb.getMany();
    const today = getTodayGMT3();

    // Exclude recurring schedulers whose cycle has ended
    // Exclude one-time schedulers that already have a net created
    const rows = await this.netRepository
      .createQueryBuilder('n')
      .select('DISTINCT n.schedulerId', 'schedulerId')
      .where('n.schedulerId IS NOT NULL')
      .getRawMany<{ schedulerId: string }>();
    const schedulerIdsWithNets = new Set(
      rows.map((r) => r.schedulerId).filter(Boolean),
    );

    const filtered = list.filter((s) => {
      if (s.endDate != null && s.endDate < today) return false;
      if (
        s.recurrence === NetRecurrence.ONE_TIME &&
        schedulerIdsWithNets.has(s.id)
      )
        return false;
      return true;
    });

    if (usePagination) {
      const total = filtered.length;
      const data = filtered.slice(offsetNum, offsetNum + limitNum);
      return { data, total, limit: limitNum, offset: offsetNum };
    }
    return filtered;
  }

  async delete(id: string): Promise<void> {
    const scheduler = await this.schedulerRepository.findOne({ where: { id } });
    if (!scheduler) {
      throw new NotFoundException('error.notFound');
    }
    await this.schedulerRepository.remove(scheduler);
  }

  /** Upcoming nets for scheduler: next N dates with resolved name. */
  async getUpcomingNets(
    schedulerId: string,
    limit: number = 3,
    locale: string = 'tr',
  ): Promise<{ date: string; scheduledAt: string; name: string }[]> {
    const scheduler = await this.findOne(schedulerId);
    const today = getTodayGMT3();
    const dates = await this.getNextOccurrenceDates(scheduler, today, limit);
    const result = dates.map((dateStr) => {
      const name = this.resolveNameTemplate(scheduler, dateStr, locale);
      const scheduledAt = `${dateStr}T${scheduler.scheduledTime.slice(0, 5)}:00+03:00`;
      return { date: dateStr, scheduledAt, name };
    });
    return result;
  }
}
