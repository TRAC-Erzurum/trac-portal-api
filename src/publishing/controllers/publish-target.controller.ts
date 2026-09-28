import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole } from '../../auth/enums/role.enum';
import { RequestWithUser } from '../../shared/types/request.types';
import { CreatePublishTargetDto, UpdatePublishTargetDto } from '../dto';
import { PublishTargetService } from '../services/publish-target.service';

/** Registry of publish targets. Super admins only; the secret is write-only. */
@Controller('publishing/targets')
@Roles(GlobalRole.SUPER_ADMIN)
export class PublishTargetController {
  constructor(private readonly targetService: PublishTargetService) {}

  @Get()
  list() {
    return this.targetService.list();
  }

  @Post()
  create(@Body() dto: CreatePublishTargetDto, @Req() req: RequestWithUser) {
    return this.targetService.create(dto, req.user.email);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePublishTargetDto,
    @Req() req: RequestWithUser,
  ) {
    return this.targetService.update(id, dto, req.user.email);
  }
}
