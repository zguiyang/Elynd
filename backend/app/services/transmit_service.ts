import transmit from '@adonisjs/transmit/services/main'
import logger from '@adonisjs/core/services/logger'

export class TransmitService {
  async toUser(channel: string, event: string, data: any): Promise<void> {
    try {
      await transmit.broadcast(channel, { event, data })
      logger.debug('[TransmitService] Message sent', { channel, event })
    } catch (error) {
      logger.error(
        { err: error, channel, event, dataPreview: JSON.stringify(data).substring(0, 200) },
        '[TransmitService] Failed to send message'
      )
      throw error
    }
  }
}
