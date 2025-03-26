import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SessionService } from '../services/session.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ManageSession } from '../decorators/manage-session.decorator';
import { CreateSessionDto } from '../dto/create-session.dto';

@Controller('session')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createSessionDto: CreateSessionDto) {
    return this.sessionService.create(createSessionDto);
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
  async startSession(@Param('id') id: string) {
    return this.sessionService.startSession(id);
  }

  @Patch(':id/end')
  @Roles(Role.VOLUNTEER)
  @ManageSession()
  async endSession(@Param('id') id: string) {
    return this.sessionService.endSession(id);
  }

  @Patch(':id/restart')
  @Roles(Role.ADMIN)
  @ManageSession()
  restartSession(@Param('id') id: string) {
    return this.sessionService.restartSession(id);
  }

  @Patch(':id/operator')
  @Roles(Role.ADMIN)
  @ManageSession()
  changeOperator(
    @Param('id') id: string,
    @Body('operatorId') operatorId: string,
  ) {
    return this.sessionService.changeOperator(id, operatorId);
  }
}
