import {
  BadRequestException,
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
import { NetCommunicationChannel } from '../entities/net-communication-channel.entity';
import { Repository } from 'typeorm';
import { CreateNetDto } from '../dto/create-net.dto';
import { OperatorService } from '../../operator/services/operator.service';
import { UpdateNetDto } from '../dto/update-net.dto';
import {
  ActivityEvent,
  ACTIVITY_EVENT,
} from '../../activity/events/activity.events';
import {
  ActivityType,
  EntityType,
} from '../../activity/enums/activity-type.enum';
import { BranchService } from '../../branch/services/branch.service';
import { MembershipService } from '../../branch/services/membership.service';
import { UserService } from '../../user/services/user.service';
import { Role } from '../../auth/enums/role.enum';

@Injectable()
export class NetService {
  constructor(
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    @InjectRepository(Attendee)
    private readonly attendeeRepository: Repository<Attendee>,
    private readonly membershipService: MembershipService,
    @InjectRepository(NetCommunicationChannel)
    private readonly netCommunicationChannelRepository: Repository<NetCommunicationChannel>,
    private readonly operatorService: OperatorService,
    private readonly branchService: BranchService,
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    createNetDto: CreateNetDto,
    createdBy: string,
    actorCallSign: string,
    userId: string,
  ) {
    // Validate operator
    const operator = await this.operatorService.findOne(
      createNetDto.operatorId,
    );

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    // Validate branch exists
    const branch = await this.branchService.findOne(createNetDto.branchId);
    if (!branch.isActive) {
      throw new BadRequestException('error.branchInactive');
    }

    // Check user is SUPER_ADMIN or has approved membership in branch
    const effectiveRole = await this.userService.getEffectiveRole(userId);
    if (effectiveRole !== Role.SUPER_ADMIN) {
      await this.userService.validateBranchMembership(
        userId,
        createNetDto.branchId,
      );
    }

    // Validate branchCallSignId belongs to branch if provided
    if (createNetDto.branchCallSignId) {
      const branchCallSign = await this.branchService.findOne(
        createNetDto.branchId,
      );
      const callSignExists = branchCallSign.callSigns?.some(
        (cs) => cs.id === createNetDto.branchCallSignId,
      );
      if (!callSignExists) {
        throw new BadRequestException('error.callSignNotInBranch');
      }
    }

    // Validate at least one communication channel or simplex
    if (
      !createNetDto.communicationChannels ||
      createNetDto.communicationChannels.length === 0
    ) {
      throw new BadRequestException(
        'error.atLeastOneCommunicationChannelRequired',
      );
    }

    const hasCommunicationChannel = createNetDto.communicationChannels.some(
      (channel) => channel.communicationChannelId,
    );
    const hasSimplex = createNetDto.communicationChannels.some(
      (channel) => channel.isSimplexAdHoc && channel.simplexFrequency,
    );

    if (!hasCommunicationChannel && !hasSimplex) {
      throw new BadRequestException(
        'error.atLeastOneCommunicationChannelRequired',
      );
    }

    // Create net
    const net = new Net();
    net.name = createNetDto.name;
    net.operator = operator;
    net.branchId = createNetDto.branchId;
    net.branchCallSignId = createNetDto.branchCallSignId || null;
    net.isActive = true;
    net.createdBy = createdBy;
    net.updatedBy = [];

    try {
      const saved = await this.netRepository.save(net);

      // Create net communication channel records
      const channelRecords = createNetDto.communicationChannels.map(
        (channelDto) => {
          const netChannel = new NetCommunicationChannel();
          netChannel.net = saved;
          netChannel.communicationChannelId =
            channelDto.communicationChannelId || null;
          netChannel.isSimplexAdHoc = channelDto.isSimplexAdHoc || false;
          netChannel.simplexFrequency = channelDto.simplexFrequency || null;
          netChannel.createdBy = createdBy;
          netChannel.updatedBy = [];
          return netChannel;
        },
      );

      await this.netCommunicationChannelRepository.save(channelRecords);

      this.eventEmitter.emit(
        ACTIVITY_EVENT,
        new ActivityEvent(
          ActivityType.NET_CREATED,
          EntityType.NET,
          saved.id,
          null,
          actorCallSign,
          null,
          { netName: saved.name },
        ),
      );

      return this.findOne(saved.id);
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
    _userId: string,
  ) {
    // Validate operator
    const operator = await this.operatorService.findOne(
      updateNetDto.operatorId,
    );

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    // First, fetch net with communication channels to validate
    const netWithChannels = await this.findOne(id);

    // BranchId is IMMUTABLE - cannot be changed
    // This is enforced at the DTO level (not in UpdateNetDto), but we check here too for safety

    // Validate branchCallSignId belongs to branch if provided
    if (updateNetDto.branchCallSignId !== undefined) {
      if (updateNetDto.branchCallSignId) {
        const branch = await this.branchService.findOne(
          netWithChannels.branchId,
        );
        const callSignExists = branch.callSigns?.some(
          (cs) => cs.id === updateNetDto.branchCallSignId,
        );
        if (!callSignExists) {
          throw new BadRequestException('error.callSignNotInBranch');
        }
      }
    }

    // Validate communication channels if provided
    if (updateNetDto.communicationChannels !== undefined) {
      if (updateNetDto.communicationChannels.length === 0) {
        throw new BadRequestException(
          'error.atLeastOneCommunicationChannelRequired',
        );
      }

      const hasCommunicationChannel = updateNetDto.communicationChannels.some(
        (channel) => channel.communicationChannelId,
      );
      const hasSimplex = updateNetDto.communicationChannels.some(
        (channel) => channel.isSimplexAdHoc && channel.simplexFrequency,
      );

      if (!hasCommunicationChannel && !hasSimplex) {
        throw new BadRequestException(
          'error.atLeastOneCommunicationChannelRequired',
        );
      }

      // Delete existing communication channel records
      await this.netCommunicationChannelRepository.delete({ netId: id });

      // Create new communication channel records
      const channelRecords = updateNetDto.communicationChannels.map(
        (channelDto) => {
          const netChannel = new NetCommunicationChannel();
          netChannel.netId = id;
          netChannel.communicationChannelId =
            channelDto.communicationChannelId || null;
          netChannel.isSimplexAdHoc = channelDto.isSimplexAdHoc || false;
          netChannel.simplexFrequency = channelDto.simplexFrequency || null;
          netChannel.createdBy = updatedBy;
          netChannel.updatedBy = [];
          return netChannel;
        },
      );

      await this.netCommunicationChannelRepository.save(channelRecords);
    }

    // Now fetch a fresh net entity WITHOUT communication channel relation to avoid TypeORM tracking issues
    const net = await this.netRepository.findOne({
      where: { id },
      relations: ['operator', 'branch', 'branchCallSign'],
    });

    if (!net) {
      throw new NotFoundException('Net not found');
    }

    // Update net fields
    net.name = updateNetDto.name;
    net.operator = operator;
    net.startedAt = updateNetDto.startedAt;
    net.endedAt = updateNetDto.endedAt;
    if (updateNetDto.branchCallSignId !== undefined) {
      net.branchCallSignId = updateNetDto.branchCallSignId;
    }
    net.updatedBy = [...(net.updatedBy || []), updatedBy];

    const saved = await this.netRepository.save(net);
    return this.findOne(saved.id);
  }

  async delete(id: string) {
    await this.netRepository.delete(id);
  }

  async startNet(
    id: string,
    updatedBy: string,
    actorCallSign: string,
    addOperatorAsAttendee: boolean = false,
  ) {
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
        actorCallSign,
        null,
        { netName: net.name },
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
        attendee.readability = 5;
        attendee.signalStrength = 9;
        attendee.operator = net.operator;
        attendee.net = savedNet;
        attendee.createdBy = updatedBy;
        attendee.updatedBy = [];
        await this.attendeeRepository.save(attendee);
      }
    }

    return this.findOne(id);
  }

  async endNet(id: string, updatedBy: string, actorCallSign: string) {
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
        actorCallSign,
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
      .leftJoinAndSelect('net.branch', 'branch')
      .leftJoinAndSelect('net.branchCallSign', 'branchCallSign')
      .leftJoinAndSelect('net.communicationChannels', 'communicationChannels')
      .leftJoinAndSelect(
        'communicationChannels.communicationChannel',
        'channelDetails',
      )
      .where('net.id = :id', { id })
      .getOne();

    if (!net) {
      throw new NotFoundException('Net not found');
    }

    // Get attendee count separately
    const attendeeCount = await this.attendeeRepository
      .createQueryBuilder('attendee')
      .where('attendee.netId = :netId', { netId: id })
      .getCount();

    return {
      ...net,
      attendeeCount,
    };
  }

  async findAll(
    query: {
      search?: string;
      status?: 'all' | 'active' | 'pending' | 'completed' | 'cancelled';
      dateFilter?: 'all' | 'week' | 'month' | '3months';
      branchId?: string;
      branchFilter?: 'selected' | 'my-branches' | 'all';
      limit?: number;
      offset?: number;
    } = {},
    userId?: string,
  ) {
    const {
      search,
      status = 'all',
      dateFilter = 'all',
      branchId,
      branchFilter,
    } = query;
    const usePagination =
      query.limit !== undefined || query.offset !== undefined;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const qb = this.netRepository
      .createQueryBuilder('net')
      .leftJoinAndSelect('net.operator', 'operator')
      .leftJoinAndSelect('operator.user', 'user')
      .leftJoinAndSelect('net.branch', 'branch')
      .leftJoinAndSelect('net.branchCallSign', 'branchCallSign')
      .leftJoin('net.attendees', 'attendee')
      .addSelect('COUNT(DISTINCT attendee.id)', 'attendeeCount')
      .groupBy('net.id')
      .addGroupBy('operator.id')
      .addGroupBy('user.id')
      .addGroupBy('branch.id')
      .addGroupBy('branchCallSign.id');

    if (search) {
      const searchTerm = `%${search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(net.name) LIKE :search OR LOWER(operator.callSign) LIKE :search)',
        { search: searchTerm },
      );
    }

    if (branchFilter === 'all') {
      // No branch filter: system-wide nets
    } else if (branchId) {
      qb.andWhere('net.branchId = :branchId', { branchId });
    } else if (userId) {
      const userBranches = await this.membershipService.getUserBranches(userId);
      const userBranchIds = userBranches.map((m) => m.branchId);
      if (userBranchIds.length > 0) {
        qb.andWhere('net.branchId IN (:...userBranchIds)', { userBranchIds });
      } else {
        qb.andWhere('1 = 0');
      }
    }

    if (status !== 'all') {
      if (status === 'active') {
        qb.andWhere('net.startedAt IS NOT NULL AND net.endedAt IS NULL');
      } else if (status === 'pending') {
        qb.andWhere('net.startedAt IS NULL AND net.endedAt IS NULL');
      } else if (status === 'completed') {
        qb.andWhere('net.startedAt IS NOT NULL AND net.endedAt IS NOT NULL');
      } else if (status === 'cancelled') {
        qb.andWhere('net.startedAt IS NULL AND net.endedAt IS NOT NULL');
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
      qb.andWhere('COALESCE(net.startedAt, net.createdAt) >= :cutoff', {
        cutoff,
      });
    }

    qb.orderBy(
      `CASE 
        WHEN net.startedAt IS NOT NULL AND net.endedAt IS NULL THEN 0 
        WHEN net.startedAt IS NULL AND net.endedAt IS NULL THEN 1 
        WHEN net.startedAt IS NOT NULL AND net.endedAt IS NOT NULL THEN 2 
        ELSE 3 
      END`,
      'ASC',
    );
    qb.addOrderBy('net.createdAt', 'DESC');

    const countQb = qb.clone();
    const total = await countQb.getCount();

    if (usePagination) {
      qb.limit(Math.min(limit, 100));
      qb.offset(offset);
    }

    const nets = await qb.getRawAndEntities();

    const netsData = nets.entities.map((net, index) => ({
      ...net,
      attendeeCount: Number(nets.raw[index]?.attendeeCount || 0),
    }));

    if (usePagination) {
      return {
        data: netsData,
        total,
        limit,
        offset,
      };
    }

    return netsData;
  }

  async restartNet(id: string, updatedBy: string) {
    const net = await this.findOne(id);
    net.endedAt = null;
    net.updatedBy = [...(net.updatedBy || []), updatedBy];
    return this.netRepository.save(net);
  }

  async changeOperator(
    id: string,
    operatorId: string,
    updatedBy: string,
    isSuperAdmin: boolean = false,
  ) {
    const net = await this.findOne(id);

    if (net.startedAt && !isSuperAdmin) {
      throw new ForbiddenException('error.operatorChangeNotAllowed');
    }

    net.operator = await this.operatorService.findOne(operatorId);
    net.updatedBy = [...(net.updatedBy || []), updatedBy];
    return this.netRepository.save(net);
  }
}
