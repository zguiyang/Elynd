import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';

import { auth } from '@elynd/auth/server';

import { AppController } from './app.controller.js';
import { MailCooldownHook } from './auth/mail-cooldown.hook.js';
import { MailCooldownService } from './auth/mail-cooldown.service.js';
import { GlobalModule } from './global/global.module.js';

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
      // Nest CORS is configured in main.ts from BETTER_AUTH_TRUSTED_ORIGINS
      disableTrustedOriginsCors: true,
    }),
    GlobalModule,
  ],
  controllers: [AppController],
  providers: [MailCooldownService, MailCooldownHook],
})
export class AppModule {}
