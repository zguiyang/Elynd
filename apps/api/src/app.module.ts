import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';

import { auth } from '@elynd/auth/server';

import { AppController } from './app.controller.js';
import { GlobalModule } from './global/global.module.js';
import { MailModule } from './mail/mail.module.js';

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
      // Nest CORS is configured in main.ts from BETTER_AUTH_TRUSTED_ORIGINS
      disableTrustedOriginsCors: true,
    }),
    GlobalModule,
    MailModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
