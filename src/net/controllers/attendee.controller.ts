import {
  Controller,
  Post,
  Param,
  Body,
  Get,
  Patch,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import { AttendeeService } from '../services/attendee.service';
import { AttendeeDto } from '../dto/attendee.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { UseGuards } from '@nestjs/common';
import { ManageNetGuard } from '../guards/manage-net.guard';
import { ManageNet } from '../decorators/manage-net.decorator';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { RequestWithUser } from '../../shared/types/request.types';

@Controller('net/:netId/attendee')
@Roles(Role.VOLUNTEER)
@UseGuards(ManageNetGuard)
export class AttendeeController {
  constructor(private readonly attendeeService: AttendeeService) {}

  @Get()
  getAttendees(
    @Param('netId') netId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.attendeeService.getAttendees(netId, pagination);
  }

  @Post()
  @ManageNet()
  async addAttendeeToNet(
    @Param('netId') netId: string,
    @Body() dto: AttendeeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.attendeeService.addAttendeeToNet(
      netId,
      dto,
      req.user.email,
      req.user.callSign,
    );
  }

  @Delete(':attendeeId')
  @ManageNet()
  async deleteAttendee(
    @Param('netId') netId: string,
    @Param('attendeeId') attendeeId: string,
  ) {
    return this.attendeeService.deleteAttendee(netId, attendeeId);
  }

  @Patch(':attendeeId')
  @ManageNet()
  async updateAttendee(
    @Param('netId') netId: string,
    @Param('attendeeId') attendeeId: string,
    @Body() dto: AttendeeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.attendeeService.updateAttendee(
      netId,
      attendeeId,
      dto,
      req.user.email,
    );
  }
}
