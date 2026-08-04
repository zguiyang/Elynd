import { Controller, Get } from '@nestjs/common';

import { PublicAPI } from './common/decorators/public-api.decorator.js';

@Controller()
export class AppController {
  @Get('health')
  @PublicAPI()
  health() {
    return { status: 'ok' };
  }
}
