import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import SystemConfig from '#models/system_config'
import { updateSystemConfigValidator } from '#validators/system_config'

@inject()
export default class SystemConfigsController {
  async index({}: HttpContext) {
    const configs = await SystemConfig.all()
    return configs.map((config) => config.serialize())
  }

  async update({ request }: HttpContext) {
    const data = await request.validateUsing(updateSystemConfigValidator)

    const results = await Promise.all(
      data.map(async (config) => {
        const existing = await SystemConfig.findBy('key', config.key)

        if (existing) {
          existing.value = config.value ?? existing.value
          if (config.description !== undefined) {
            existing.description = config.description
          }
          await existing.save()
          return existing.serialize()
        } else {
          const newConfig = await SystemConfig.create({
            key: config.key,
            value: config.value ?? null,
            description: config.description ?? null,
          })
          return newConfig.serialize()
        }
      })
    )

    return results
  }
}
