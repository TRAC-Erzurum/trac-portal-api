import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { AuthorizationRequestDto } from '../dto/authorization-request.dto';
import { TokenRequestDto } from '../dto/token-request.dto';
import { OidcKeyService } from '../services/oidc-key.service';
import { ClientCredentials, OidcService } from '../services/oidc.service';

const REFUSAL_PAGE = `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TRAC Portal</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;line-height:1.5}h1{font-size:1.25rem}</style>
</head>
<body>
<h1>Giriş isteği reddedildi</h1>
<p>Bu uygulama TRAC Portal'a kayıtlı değil veya geri dönüş adresi kayıtlı adreslerle eşleşmiyor. Güvenliğiniz için yönlendirme yapılmadı.</p>
<hr>
<h1 lang="en">Sign-in request refused</h1>
<p lang="en">This application is not registered with TRAC Portal, or its return address does not match a registered one. For your safety you were not redirected.</p>
</body>
</html>`;

/** Parses `Authorization: Basic` per RFC 6749 §2.3.1 (form-urlencoded, then base64). */
function parseBasic(header: string | undefined):
  | {
      clientId: string;
      clientSecret: string;
    }
  | null
  | 'malformed' {
  if (!header || !/^basic /i.test(header)) return null;
  const decoded = Buffer.from(header.slice(6).trim(), 'base64').toString(
    'utf8',
  );
  const separator = decoded.indexOf(':');
  if (separator < 0) return 'malformed';
  try {
    const decode = (s: string) => decodeURIComponent(s.replace(/\+/g, ' '));
    return {
      clientId: decode(decoded.slice(0, separator)),
      clientSecret: decode(decoded.slice(separator + 1)),
    };
  } catch {
    return 'malformed';
  }
}

function clientCredentials(
  authorization: string | undefined,
  body: TokenRequestDto,
): ClientCredentials {
  const basic = parseBasic(authorization);
  const hasPost = body.client_secret !== undefined;
  if (basic && hasPost) return { method: 'both' };
  if (basic === 'malformed') return { method: 'none' };
  if (basic) {
    // A client_id in the body must agree with the authenticated one.
    if (body.client_id !== undefined && body.client_id !== basic.clientId) {
      return { method: 'none' };
    }
    return { ...basic, method: 'client_secret_basic' };
  }
  if (hasPost) {
    return {
      clientId: body.client_id,
      clientSecret: body.client_secret,
      method: 'client_secret_post',
    };
  }
  return { method: 'none' };
}

@Controller('oidc')
export class OidcController {
  constructor(
    private readonly oidcService: OidcService,
    private readonly keyService: OidcKeyService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get('.well-known/openid-configuration')
  discovery() {
    return this.oidcService.discovery();
  }

  @Public()
  @SkipThrottle()
  @Get('jwks')
  async jwks() {
    return this.keyService.getJwks();
  }

  @Public()
  @Get('authorize')
  async authorize(
    @Query() query: AuthorizationRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    const result = await this.oidcService.validateAuthorizationRequest(query);
    if (result.kind === 'refused') {
      res.status(HttpStatus.BAD_REQUEST).type('html').send(REFUSAL_PAGE);
      return;
    }
    res.redirect(
      HttpStatus.FOUND,
      result.kind === 'redirect_error'
        ? result.redirectTo
        : this.oidcService.consentPageUrl(query),
    );
  }

  @Public()
  // Called by client servers: one IP serves every user of that client.
  @SkipThrottle()
  @Post('token')
  async token(
    @Body() body: TokenRequestDto,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    const credentials = clientCredentials(authorization, body ?? {});
    try {
      const tokens = await this.oidcService.exchangeCode(
        body ?? {},
        credentials,
      );
      res.status(HttpStatus.OK).json(tokens);
    } catch (err) {
      if (!(err instanceof HttpException)) throw err;
      const status: number = err.getStatus();
      if (status === 401 && credentials.method === 'client_secret_basic') {
        res.setHeader('WWW-Authenticate', 'Basic realm="oidc"');
      }
      res.status(status).json(err.getResponse());
    }
  }

  private async userinfo(authorization: string | undefined, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const match = /^Bearer (\S+)$/i.exec(authorization ?? '');
    const claims = await this.oidcService.userinfo(match?.[1]);
    if (!claims) {
      res
        .status(HttpStatus.UNAUTHORIZED)
        .setHeader('WWW-Authenticate', 'Bearer error="invalid_token"')
        .json({
          error: 'invalid_token',
          error_description: 'Access token missing, expired or revoked',
        });
      return;
    }
    res.status(HttpStatus.OK).json(claims);
  }

  @Public()
  @SkipThrottle()
  @Get('userinfo')
  async userinfoGet(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.userinfo(authorization, res);
  }

  @Public()
  @SkipThrottle()
  @Post('userinfo')
  async userinfoPost(
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.userinfo(authorization, res);
  }
}
