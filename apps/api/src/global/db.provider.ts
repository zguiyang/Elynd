import type { FactoryProvider } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Db } from '@elynd/db';
import { setupDb } from '@elynd/db';

export const DB = Symbol('DB_SERVICE');

export const DbProvider: FactoryProvider<Db> = {
  provide: DB,
  useFactory: (config: ConfigService) => {
    const logger = new Logger('DB Provider');
    logger.log('Connecting to database...');

    const connectionString = config.get<string>('DATABASE_URI') ?? process.env.DATABASE_URI;

    if (!connectionString) {
      throw new Error('DATABASE_URI is required to initialize the database');
    }

    const db = setupDb(connectionString);
    return db;
  },
  inject: [ConfigService],
};
