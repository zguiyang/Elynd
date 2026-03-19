import { inject } from '@adonisjs/core'
import transmit from '@adonisjs/transmit/services/main'
import logger from '@adonisjs/core/services/logger'
import type { Broadcastable } from '@boringnode/transmit/types'

@inject()
export class TransmitService {
  async toUser(channel: string, event: string, data: Broadcastable): Promise<void> {
    try {
      await transmit.broadcast(channel, { event, data })
      logger.debug({ channel, event }, '[TransmitService] Message sent')
    } catch (error) {
      logger.error(
        { err: error, channel, event, dataPreview: JSON.stringify(data).substring(0, 200) },
        '[TransmitService] Failed to send message'
      )
      throw error
    }
  }
}
