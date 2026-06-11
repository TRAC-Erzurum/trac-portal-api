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
  UseGuards,
} from '@nestjs/common';
import { AllowWithoutCallsign } from '../../auth/decorators/allow-without-callsign.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole } from '../../auth/enums/role.enum';
import { PortalOrBranchLeaderGuard } from '../../branch/guards/portal-or-branch-leader.guard';
import { RequestWithUser } from '../../shared/types/request.types';
import {
  AssignMemberDto,
  CreateDisasterDto,
  CreateObservationDto,
  DisasterQueryDto,
  ObservationQueryDto,
  SimilarObservationQueryDto,
  UpdateDisasterDto,
  UpdateMemberDto,
} from '../dto';
import { DisasterAdminGuard } from '../guards/disaster-admin.guard';
import { DisasterService } from '../services/disaster.service';
import { DisasterMembershipService } from '../services/disaster-membership.service';
import { ObservationService } from '../services/observation.service';
@Controller('disaster')
@Roles(GlobalRole.GUEST)
export class DisasterController {
  constructor(
    private readonly disasterService: DisasterService,
    private readonly membershipService: DisasterMembershipService,
    private readonly observationService: ObservationService,
  ) {}

  @Get()
  @AllowWithoutCallsign()
  findAll(@Query() query: DisasterQueryDto) {
    return this.disasterService.findAll(query);
  }

  @Get(':id')
  @AllowWithoutCallsign()
  findOne(@Param('id') id: string) {
    return this.disasterService.findOne(id);
  }

  @Post()
  @UseGuards(PortalOrBranchLeaderGuard)
  @AllowWithoutCallsign()
  create(@Body() dto: CreateDisasterDto, @Req() req: RequestWithUser) {
    return this.disasterService.create(
      dto,
      req.user.id,
      req.user.email,
      req.user.callSign,
    );
  }

  @Patch(':id')
  @UseGuards(DisasterAdminGuard)
  @AllowWithoutCallsign()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDisasterDto,
    @Req() req: RequestWithUser,
  ) {
    return this.disasterService.update(id, dto, req.user.email);
  }

  @Post(':id/archive')
  @UseGuards(DisasterAdminGuard)
  @AllowWithoutCallsign()
  archive(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.disasterService.archive(id, req.user.id, req.user.callSign);
  }

  @Post(':id/reactivate')
  @UseGuards(DisasterAdminGuard)
  @AllowWithoutCallsign()
  reactivate(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.disasterService.reactivate(id, req.user.email);
  }

  @Get(':id/members')
  @UseGuards(DisasterAdminGuard)
  @AllowWithoutCallsign()
  listMembers(@Param('id') id: string) {
    return this.membershipService.listMembers(id);
  }

  @Post(':id/members')
  @UseGuards(DisasterAdminGuard)
  @AllowWithoutCallsign()
  assignMember(
    @Param('id') id: string,
    @Body() dto: AssignMemberDto,
    @Req() req: RequestWithUser,
  ) {
    return this.membershipService.assignMember(
      id,
      dto,
      req.user.id,
      req.user.email,
    );
  }

  @Patch(':id/members/:userId')
  @UseGuards(DisasterAdminGuard)
  @AllowWithoutCallsign()
  updateMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
    @Req() req: RequestWithUser,
  ) {
    return this.membershipService.updateMember(id, userId, dto, req.user.email);
  }

  @Delete(':id/members/:userId')
  @UseGuards(DisasterAdminGuard)
  @AllowWithoutCallsign()
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.membershipService.removeMember(id, userId);
  }

  @Get(':id/observations')
  @AllowWithoutCallsign()
  listObservations(
    @Param('id') id: string,
    @Query() query: ObservationQueryDto,
  ) {
    return this.observationService.findRanked(id, query);
  }

  @Get(':id/observations/similar')
  @AllowWithoutCallsign()
  findSimilar(
    @Param('id') id: string,
    @Query() query: SimilarObservationQueryDto,
  ) {
    return this.observationService.findSimilar(id, query);
  }

  @Post(':id/observations')
  @AllowWithoutCallsign()
  createObservation(
    @Param('id') id: string,
    @Body() dto: CreateObservationDto,
    @Req() req: RequestWithUser,
  ) {
    return this.observationService.create(
      id,
      dto,
      req.user.id,
      req.user.email,
      req.user.callSign,
    );
  }
}
