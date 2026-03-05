import cron from 'node-cron'
import { DictionaryService } from '#services/dictionary_service'

export async function registerCronTasks() {
  const { default: logger } = await import('@adonisjs/core/services/logger')

  logger.info('Registering cron tasks')

  cron.schedule('0 3 * * *', async () => {
    logger.info('Starting dictionary cache refresh task')

    try {
      const dictionaryService = new DictionaryService()
      const expiringKeys = await dictionaryService.getExpiringKeys()

      logger.info({ count: expiringKeys.length }, 'Found expiring dictionary cache keys')

      for (const key of expiringKeys) {
        const word = key.replace('dictionary:', '')
        try {
          await dictionaryService.refreshCache(word)
        } catch (error) {
          logger.error({ err: error, word }, 'Failed to refresh cache for word')
        }
      }

      logger.info('Dictionary cache refresh task completed')
    } catch (error) {
      logger.error({ err: error }, 'Dictionary cache refresh task failed')
    }
  })

  logger.info('Cron tasks registered successfully')
}
