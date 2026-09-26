import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole } from '../../auth/enums/role.enum';
import { RequestWithUser } from '../../shared/types/request.types';
import { CreateOidcClientDto } from '../dto/create-oidc-client.dto';
import { OidcClientService } from '../services/oidc-client.service';
import { OidcKeyService } from '../services/oidc-key.service';

@Controller('oidc/admin')
@Roles(GlobalRole.SUPER_ADMIN)
export class OidcAdminController {
  constructor(
    private readonly clientService: OidcClientService,
    private readonly keyService: OidcKeyService,
  ) {}

  @Get('clients')
  async listClients() {
    return this.clientService.list();
  }

  @Post('clients')
  async createClient(
    @Body() dto: CreateOidcClientDto,
    @Req() req: RequestWithUser,
  ) {
    return this.clientService.create(dto, req.user.email);
  }

  @Post('clients/:id/rotate-secret')
  @HttpCode(200)
  async rotateSecret(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.clientService.rotateSecret(id, req.user.email);
  }

  @Post('clients/:id/deactivate')
  @HttpCode(200)
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.clientService.deactivate(id, req.user.email);
  }

  @Post('keys/rotate')
  @HttpCode(200)
  async rotateKey(@Req() req: RequestWithUser) {
    return this.keyService.rotate(req.user.email);
  }
}
