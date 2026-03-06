import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import SystemConfig from '#models/system_config'
import { updateSystemConfigValidator } from '#validators/system_config_validator'

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
      aiModelName: config.aiModelName,
      hasApiKey: !!config.aiApiKey,
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
      const updates: Record<string, any> = {}

      if (data.aiBaseUrl !== undefined) {
        updates.aiBaseUrl = data.aiBaseUrl || null
      }
      if (data.aiApiKey !== undefined) {
        updates.aiApiKey = data.aiApiKey || null
      }
      if (data.aiModelName !== undefined) {
        updates.aiModelName = data.aiModelName || null
      }

      if (Object.keys(updates).length > 0) {
        config.merge(updates)
        await config.save()
      }
    }

    return {
      aiBaseUrl: config.aiBaseUrl,
      aiModelName: config.aiModelName,
      hasApiKey: !!config.aiApiKey,
    }
  }
}
