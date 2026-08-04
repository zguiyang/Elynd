import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'

import { AuthModule } from '../auth/auth.module.js'
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter.js'
import { AuthGuard } from '../common/guards/auth.guard.js'
import { DB, DbProvider } from './providers/db.provider.js'

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    AuthModule
  ],
  providers: [
    DbProvider,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    }
  ],
  exports: [DB]
})
export class GlobalModule {}
