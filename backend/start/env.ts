/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  RESEND_API_KEY: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring app URLs
  |----------------------------------------------------------
  */
  APP_URL: Env.schema.string(),
  CLIENT_URL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring mail sender
  |----------------------------------------------------------
  */
  MAIL_FROM_ADDRESS: Env.schema.string.optional(),
  MAIL_FROM_NAME: Env.schema.string.optional(),

  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_DB: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),
  REDIS_QUEUE: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring TTS service (Azure Speech)
  |----------------------------------------------------------
  */
  TTS_API_KEY: Env.schema.string(),
  TTS_REGION: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring book audio processing
  |----------------------------------------------------------
  */
  BOOK_AUDIO_CHAPTER_CONCURRENCY: Env.schema.number(),
  BOOK_AUDIO_CHUNK_MAX_CHARS: Env.schema.number(),

  /**
   * Configuration for dictionary API
   */
  FREE_DICTIONARY_API_URL: Env.schema.string(),
})
