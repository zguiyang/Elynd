import { inject } from '@adonisjs/core'
import { Edge } from 'edge.js'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'

const PROMPTS_PATH = 'resources/prompts'

@inject()
export default class PromptService {
  private edge: Edge

  constructor() {
    this.edge = new Edge()
    this.edge.mount(app.makePath(PROMPTS_PATH))
  }

  render(name: string, data: Record<string, any> = {}): string {
    try {
      return this.edge.renderSync(`${name}`, data)
    } catch (error) {
      logger.error({ err: error }, `[PromptService] Failed to render: ${name}`)
      throw error
    }
  }
}
