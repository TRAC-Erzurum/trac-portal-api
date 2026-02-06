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
import { InfrastructureService } from '../services/infrastructure.service';
import { CreateInfrastructureDto } from '../dto/create-infrastructure.dto';
import { UpdateInfrastructureDto } from '../dto/update-infrastructure.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { RequestWithUser } from '../../shared/types/request.types';
import { InfrastructureType } from '../enums/infrastructure-type.enum';

@Controller('infrastructure')
export class InfrastructureController {
  constructor(private readonly infrastructureService: InfrastructureService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  async create(
    @Body() createInfrastructureDto: CreateInfrastructureDto,
    @Req() req: RequestWithUser,
  ) {
    return this.infrastructureService.create(createInfrastructureDto, req.user.id);
  }

  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query('branchId') branchId?: string,
    @Query('type') type?: InfrastructureType,
    @Query('search') search?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('pageNumber') pageNumber?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const options: {
      branchId?: string;
      type?: InfrastructureType;
      search?: string;
      includeInactive?: boolean;
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

    if (includeInactive === 'true' && req.user.role === Role.SUPER_ADMIN) {
      options.includeInactive = true;
    }

    if (pageNumber) {
      options.pageNumber = parseInt(pageNumber, 10);
    }

    if (pageSize) {
      options.pageSize = parseInt(pageSize, 10);
    }

    return this.infrastructureService.findAll(options);
  }

  @Get('tutorials')
  async getAllTutorials(@Query('locale') locale?: string) {
    return this.infrastructureService.getAllTutorials(locale || 'tr');
  }

  @Get('tutorials/:type')
  async getTutorial(
    @Param('type') type: InfrastructureType,
    @Query('locale') locale?: string,
  ) {
    return this.infrastructureService.getTutorial(type, locale || 'tr');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.infrastructureService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateInfrastructureDto: UpdateInfrastructureDto,
    @Req() req: RequestWithUser,
  ) {
    return this.infrastructureService.update(id, updateInfrastructureDto, req.user.id);
  }

  @Patch(':id/activate')
  @Roles(Role.SUPER_ADMIN)
  async activate(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.infrastructureService.activate(id, req.user.id);
  }

  @Patch(':id/deactivate')
  @Roles(Role.SUPER_ADMIN)
  async deactivate(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.infrastructureService.deactivate(id, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  async delete(@Param('id') id: string) {
    await this.infrastructureService.delete(id);
    return { success: true };
  }
}

@Controller('branches/:branchId/infrastructure')
export class BranchInfrastructureController {
  constructor(private readonly infrastructureService: InfrastructureService) {}

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
    return this.infrastructureService.findByBranch(branchId, includeInactiveFlag, page, size, search, type);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  async create(
    @Param('branchId') branchId: string,
    @Body() dto: CreateInfrastructureDto,
    @Req() req: RequestWithUser,
  ) {
    dto.branchId = branchId;
    return this.infrastructureService.create(dto, req.user.id);
  }
}
