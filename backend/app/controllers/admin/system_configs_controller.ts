import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { ConfigService } from '#services/ai/config_service'
import { updateSystemConfigValidator } from '#validators/system_config_validator'

@inject()
export default class SystemConfigsController {
  constructor(private configService: ConfigService) {}

  async index({}: HttpContext) {
    return this.configService.getSystemConfigSummary()
  }

  async update({ request }: HttpContext) {
    const data = await request.validateUsing(updateSystemConfigValidator)
    return this.configService.updateSystemConfig(data)
  }
}
