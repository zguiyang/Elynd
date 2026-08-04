import { Module } from '@nestjs/common';

import { ExamplesModule } from './api/examples/examples.module.js';
import { AppController } from './app.controller.js';
import { GlobalModule } from './global/global.module.js';

@Module({
  imports: [GlobalModule, ExamplesModule],
  controllers: [AppController],
})
export class AppModule {}
