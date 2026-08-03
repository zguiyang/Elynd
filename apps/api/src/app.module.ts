import { Module } from '@nestjs/common'

import { AppController } from './app.controller.js'
import { GlobalModule } from './global/global.module.js'

@Module({
  imports: [GlobalModule],
  controllers: [AppController]
})
export class AppModule {}
