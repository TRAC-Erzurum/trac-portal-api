import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole, BranchRole } from '../../auth/enums/role.enum';
import { EquipmentStatusService } from '../services/equipment-status.service';
import { CreateEquipmentStatusDto, UpdateEquipmentStatusDto } from '../dto';

@Controller('equipment-statuses')
@Roles(BranchRole.VOLUNTEER)
export class EquipmentStatusController {
  constructor(private readonly statusService: EquipmentStatusService) {}

  @Get()
  findAll() {
    return this.statusService.findAll();
  }

  @Post()
  @Roles(GlobalRole.SUPER_ADMIN)
  create(@Body() dto: CreateEquipmentStatusDto, @Req() req: any) {
    return this.statusService.create(dto, req.user.email);
  }

  @Patch(':id')
  @Roles(GlobalRole.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentStatusDto,
    @Req() req: any,
  ) {
    return this.statusService.update(id, dto, req.user.email);
  }

  @Delete(':id')
  @Roles(GlobalRole.SUPER_ADMIN)
  delete(@Param('id') id: string) {
    return this.statusService.delete(id);
  }
}
