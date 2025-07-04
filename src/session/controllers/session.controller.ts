import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { SessionService } from '../services/session.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ManageSession } from '../decorators/manage-session.decorator';
import { CreateSessionDto } from '../dto/create-session.dto';
import { UpdateSessionDto } from '../dto/update-session.dto';
import { RequestWithUser } from '../../shared/types/request.types';

@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(
    @Body() createSessionDto: CreateSessionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.sessionService.create(createSessionDto, req.user.email);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  updateSession(
    @Param('id') id: string,
    @Body() updateSessionDto: UpdateSessionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.sessionService.update(id, updateSessionDto, req.user.email);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  deleteSession(@Param('id') id: string) {
    return this.sessionService.delete(id);
  }

  @Get()
  findAll() {
    return this.sessionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessionService.findOne(id);
  }

  @Patch(':id/start')
  @Roles(Role.VOLUNTEER)
  @ManageSession()
  async startSession(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sessionService.startSession(id, req.user.email);
  }

  @Patch(':id/end')
  @Roles(Role.VOLUNTEER)
  @ManageSession()
  async endSession(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sessionService.endSession(id, req.user.email);
  }

  @Patch(':id/restart')
  @Roles(Role.ADMIN)
  @ManageSession()
  restartSession(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.sessionService.restartSession(id, req.user.email);
  }

  @Patch(':id/operator')
  @Roles(Role.ADMIN)
  @ManageSession()
  changeOperator(
    @Param('id') id: string,
    @Body('operatorId') operatorId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.sessionService.changeOperator(id, operatorId, req.user.email);
  }
}
