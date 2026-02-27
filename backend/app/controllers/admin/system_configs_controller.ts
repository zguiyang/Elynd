import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import SystemConfig from '#models/system_config'
import { updateSystemConfigValidator } from '#validators/system_config'

@inject()
export default class SystemConfigsController {
  async index({}: HttpContext) {
    let config = await SystemConfig.first()

    if (!config) {
      config = await SystemConfig.create({
        aiBaseUrl: null,
        aiApiKey: null,
        aiModelName: null,
      })
    }

    return {
      aiBaseUrl: config.aiBaseUrl,
      aiApiKey: config.aiApiKey,
      aiModelName: config.aiModelName,
    }
  }

  async update({ request }: HttpContext) {
    const data = await request.validateUsing(updateSystemConfigValidator)

    let config = await SystemConfig.first()

    if (!config) {
      config = await SystemConfig.create({
        aiBaseUrl: data.aiBaseUrl ?? null,
        aiApiKey: data.aiApiKey ?? null,
        aiModelName: data.aiModelName ?? null,
      })
    } else {
      config.merge({
        aiBaseUrl: data.aiBaseUrl ?? config.aiBaseUrl,
        aiApiKey: data.aiApiKey ?? config.aiApiKey,
        aiModelName: data.aiModelName ?? config.aiModelName,
      })
      await config.save()
    }

    return {
      aiBaseUrl: config.aiBaseUrl,
      aiApiKey: config.aiApiKey,
      aiModelName: config.aiModelName,
    }
  }
}
