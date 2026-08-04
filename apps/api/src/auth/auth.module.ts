import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthApplicationService } from './auth-application.service.js';
import { AUTH_CLIENT } from './auth-client.port.js';
import { BetterAuthAdapter } from './better-auth.adapter.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthApplicationService,
    BetterAuthAdapter,
    {
      provide: AUTH_CLIENT,
      useExisting: BetterAuthAdapter,
    },
  ],
  exports: [AuthService, AuthApplicationService],
})
export class AuthModule {}
