import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import UserConfig from '#models/user_config'
import type { UpdateUserConfigData } from '#validators/user_config_validator'

@inject()
export class UserConfigService {
  async getConfigByUserId(userId: number): Promise<UserConfig | null> {
    return UserConfig.findBy('user_id', userId)
  }

  async create(userId: number): Promise<UserConfig> {
    logger.info({ userId }, 'Creating user config')

    const config = await UserConfig.create({
      userId,
      nativeLanguage: 'zh',
      targetLanguage: 'en',
      vocabularyLevel: 'beginner',
      learningInitCompleted: false,
    })

    logger.info({ userId, configId: config.id }, 'User config created')

    return config
  }

  async update(userId: number, data: UpdateUserConfigData): Promise<UserConfig> {
    logger.info({ userId }, 'Updating user config')

    const config = await UserConfig.findByOrFail('user_id', userId)

    config.merge(data)
    await config.save()

    logger.info({ userId }, 'User config updated')

    return config
  }
}
