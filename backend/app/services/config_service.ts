import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import SystemConfig from '#models/system_config'
import { UserConfigService } from '#services/user_config_service'
import { AI } from '#constants'
import type { AiClientConfig } from '#types/ai'
import type { UserLanguageConfig } from '#types/book'
import type { FullUserConfig } from '#types/book_generation'

@inject()
export class ConfigService {
  constructor(private userConfigService: UserConfigService) {}

  async getAiConfig(): Promise<AiClientConfig> {
    const config = await SystemConfig.first()

    if (!config?.aiBaseUrl || !config?.aiApiKey || !config?.aiModelName) {
      throw new Exception('AI configuration is not properly configured', { status: 500 })
    }

    return {
      baseUrl: config.aiBaseUrl,
      apiKey: config.aiApiKey,
      model: config.aiModelName,
      timeout: AI.ARTICLE_GENERATION_TIMEOUT,
    }
  }

  async getUserLanguageConfig(userId: number): Promise<UserLanguageConfig> {
    const userConfig = await this.userConfigService.getConfigByUserId(userId)

    return {
      nativeLanguage: userConfig?.nativeLanguage || 'zh',
      targetLanguage: userConfig?.targetLanguage || 'en',
      englishVariant: userConfig?.englishVariant || 'en-US',
    }
  }

  async getFullUserConfig(userId: number): Promise<FullUserConfig> {
    const userConfig = await this.userConfigService.getConfigByUserId(userId)

    return {
      nativeLanguage: userConfig?.nativeLanguage || 'zh',
      targetLanguage: userConfig?.targetLanguage || 'en',
      englishVariant: userConfig?.englishVariant || 'en-US',
      vocabularyLevel: userConfig?.vocabularyLevel || 'intermediate',
    }
  }
}
