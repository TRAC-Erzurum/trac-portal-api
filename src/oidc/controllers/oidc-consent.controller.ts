import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { AllowWithoutCallsign } from '../../auth/decorators/allow-without-callsign.decorator';
import { RequestWithUser } from '../../shared/types/request.types';
import { AuthorizationRequestDto } from '../dto/authorization-request.dto';
import { OidcService } from '../services/oidc.service';

/**
 * Called by the UI consent page with the original authorization request.
 * Requires a portal session; a user without a call sign may still sign in
 * (they are simply reported `verified: false`).
 */
@Controller('oidc/consent')
@AllowWithoutCallsign()
export class OidcConsentController {
  constructor(private readonly oidcService: OidcService) {}

  @Post('context')
  @HttpCode(200)
  async context(
    @Body() params: AuthorizationRequestDto,
    @Req() req: RequestWithUser,
  ) {
    return this.oidcService.getConsentContext(params, req.user.id);
  }

  @Post('approve')
  @HttpCode(200)
  async approve(
    @Body() params: AuthorizationRequestDto,
    @Req() req: RequestWithUser,
  ) {
    return this.oidcService.approve(params, req.user.id);
  }

  @Post('deny')
  @HttpCode(200)
  async deny(@Body() params: AuthorizationRequestDto) {
    return this.oidcService.deny(params);
  }
}
