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
import { ManageSessionGuard } from '../guards/manage-session.guard';
import { ManageSession } from '../decorators/manage-session.decorator';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { RequestWithUser } from '../../shared/types/request.types';

@Controller('session/:sessionId/attendee')
@Roles(Role.VOLUNTEER)
@UseGuards(ManageSessionGuard)
export class AttendeeController {
  constructor(private readonly attendeeService: AttendeeService) {}

  @Get()
  getAttendees(
    @Param('sessionId') sessionId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.attendeeService.getAttendees(sessionId, pagination);
  }

  @Post()
  @ManageSession()
  async addAttendeeToSession(
    @Param('sessionId') sessionId: string,
    @Body() dto: AttendeeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.attendeeService.addAttendeeToSession(
      sessionId,
      dto,
      req.user.email,
    );
  }

  @Delete(':attendeeId')
  @ManageSession()
  async deleteAttendee(
    @Param('sessionId') sessionId: string,
    @Param('attendeeId') attendeeId: string,
  ) {
    return this.attendeeService.deleteAttendee(sessionId, attendeeId);
  }

  @Patch(':attendeeId')
  @ManageSession()
  async updateAttendee(
    @Param('sessionId') sessionId: string,
    @Param('attendeeId') attendeeId: string,
    @Body() dto: AttendeeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.attendeeService.updateAttendee(
      sessionId,
      attendeeId,
      dto,
      req.user.email,
    );
  }
}
