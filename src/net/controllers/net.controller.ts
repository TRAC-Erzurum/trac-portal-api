import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { NetService } from '../services/net.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ManageNet } from '../decorators/manage-net.decorator';
import { CreateNetDto } from '../dto/create-net.dto';
import { UpdateNetDto } from '../dto/update-net.dto';
import { StartNetDto } from '../dto/start-net.dto';
import { NetQueryDto } from '../dto/net-query.dto';
import { RequestWithUser } from '../../shared/types/request.types';

@Controller('net')
export class NetController {
  constructor(private readonly netService: NetService) {}

  @Post()
  @Roles(Role.MEMBER)
  create(
    @Body() createNetDto: CreateNetDto,
    @Req() req: RequestWithUser,
  ) {
    return this.netService.create(createNetDto, req.user.email);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  updateNet(
    @Param('id') id: string,
    @Body() updateNetDto: UpdateNetDto,
    @Req() req: RequestWithUser,
  ) {
    return this.netService.update(id, updateNetDto, req.user.email);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  deleteNet(@Param('id') id: string) {
    return this.netService.delete(id);
  }

  @Get()
  findAll(@Query() query: NetQueryDto) {
    return this.netService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.netService.findOne(id);
  }

  @Patch(':id/start')
  @Roles(Role.VOLUNTEER)
  @ManageNet()
  async startNet(
    @Param('id') id: string,
    @Body() startNetDto: StartNetDto,
    @Req() req: RequestWithUser,
  ) {
    return this.netService.startNet(id, req.user.email, startNetDto.addOperatorAsAttendee);
  }

  @Patch(':id/end')
  @Roles(Role.VOLUNTEER)
  @ManageNet()
  async endNet(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.netService.endNet(id, req.user.email);
  }

  @Patch(':id/restart')
  @Roles(Role.ADMIN)
  @ManageNet()
  restartNet(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.netService.restartNet(id, req.user.email);
  }

  @Patch(':id/operator')
  @Roles(Role.ADMIN)
  @ManageNet()
  changeOperator(
    @Param('id') id: string,
    @Body('operatorId') operatorId: string,
    @Req() req: RequestWithUser,
  ) {
    const isSuperAdmin = req.user.role === Role.SUPER_ADMIN;
    return this.netService.changeOperator(id, operatorId, req.user.email, isSuperAdmin);
  }
}
