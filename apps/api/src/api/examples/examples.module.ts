import { Module } from '@nestjs/common';

import { ExamplesController } from './examples.controller.js';
import { ExamplesService } from './examples.service.js';

@Module({
  controllers: [ExamplesController],
  providers: [ExamplesService],
})
export class ExamplesModule {}
