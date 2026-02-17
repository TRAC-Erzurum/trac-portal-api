import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CommunicationChannelService } from '../services/communication-channel.service';
import { CreateCommunicationChannelDto } from '../dto/create-communication-channel.dto';
import { UpdateCommunicationChannelDto } from '../dto/update-communication-channel.dto';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { RequestWithUser } from '../../shared/types/request.types';
import { CommunicationChannelType } from '../enums/communication-channel-type.enum';

@Controller('communication-channel')
export class CommunicationChannelController {
  constructor(
    private readonly communicationChannelService: CommunicationChannelService,
  ) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  async create(
    @Body() createCommunicationChannelDto: CreateCommunicationChannelDto,
    @Req() req: RequestWithUser,
  ) {
    return this.communicationChannelService.create(
      createCommunicationChannelDto,
      req.user.id,
    );
  }

  @Get()
  @Public()
  async findAll(
    @Req() req: RequestWithUser,
    @Query('branchId') branchId?: string,
    @Query('type') type?: CommunicationChannelType,
    @Query('search') search?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('hasLocation') hasLocation?: string,
    @Query('pageNumber') pageNumber?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const options: {
      branchId?: string;
      type?: CommunicationChannelType;
      search?: string;
      includeInactive?: boolean;
      hasLocation?: boolean;
      minimalBranch?: boolean;
      pageNumber?: number;
      pageSize?: number;
    } = {};

    if (branchId) {
      options.branchId = branchId;
    }

    if (type) {
      options.type = type;
    }

    if (search) {
      options.search = search;
    }

    if (includeInactive === 'true' && req.user?.role === Role.SUPER_ADMIN) {
      options.includeInactive = true;
    }

    if (pageNumber) {
      options.pageNumber = parseInt(pageNumber, 10);
    }

    if (pageSize) {
      options.pageSize = parseInt(pageSize, 10);
    }

    if (hasLocation === 'true') {
      options.hasLocation = true;
    }

    if (req.user == null) {
      options.minimalBranch = true;
    }

    return this.communicationChannelService.findAll(options);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    const minimalBranch = req.user == null;
    return this.communicationChannelService.findOne(id, minimalBranch);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateCommunicationChannelDto: UpdateCommunicationChannelDto,
    @Req() req: RequestWithUser,
  ) {
    return this.communicationChannelService.update(
      id,
      updateCommunicationChannelDto,
      req.user.id,
    );
  }

  @Patch(':id/activate')
  @Roles(Role.SUPER_ADMIN)
  async activate(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.communicationChannelService.activate(id, req.user.id);
  }

  @Patch(':id/deactivate')
  @Roles(Role.SUPER_ADMIN)
  async deactivate(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.communicationChannelService.deactivate(id, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  async delete(@Param('id') id: string) {
    await this.communicationChannelService.delete(id);
    return { success: true };
  }
}

@Controller('branches/:branchId/communication-channel')
export class BranchCommunicationChannelController {
  constructor(
    private readonly communicationChannelService: CommunicationChannelService,
  ) {}

  @Get()
  async findByBranch(
    @Param('branchId') branchId: string,
    @Req() req: RequestWithUser,
    @Query('includeInactive') includeInactive?: string,
    @Query('pageNumber') pageNumber?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    const includeInactiveFlag =
      includeInactive === 'true' && req.user.role === Role.SUPER_ADMIN;
    const page = pageNumber ? parseInt(pageNumber, 10) : undefined;
    const size = pageSize ? parseInt(pageSize, 10) : undefined;
    return this.communicationChannelService.findByBranch(
      branchId,
      includeInactiveFlag,
      page,
      size,
      search,
      type,
    );
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  async create(
    @Param('branchId') branchId: string,
    @Body() dto: CreateCommunicationChannelDto,
    @Req() req: RequestWithUser,
  ) {
    dto.branchId = branchId;
    return this.communicationChannelService.create(dto, req.user.id);
  }
}
