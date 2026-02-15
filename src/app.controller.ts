import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      ...(process.env.APP_VERSION && { version: process.env.APP_VERSION }),
      ...(process.env.UI_VERSION && { uiVersion: process.env.UI_VERSION }),
    };
  }
}
