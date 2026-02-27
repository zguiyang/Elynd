import env from '#start/env'
import { defineConfig } from 'adonisjs-jobs'

const jobsConfig = defineConfig({
  connection: {
    host: env.get('REDIS_HOST', 'localhost'),
    port: env.get('REDIS_PORT', 6379),
    password: env.get('REDIS_PASSWORD'),
  },

  queue: env.get('REDIS_QUEUE', 'elynd_jobs'),

  queues: [env.get('REDIS_QUEUE', 'elynd_jobs')],

  options: {
    attempts: 0,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
})

export default jobsConfig
