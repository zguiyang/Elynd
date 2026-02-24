import transmit from '@adonisjs/transmit/services/main'

export class TransmitService {
  async toUser(channel: string, event: string, data: any): Promise<void> {
    await transmit.broadcast(channel, { event, data })
  }
}
