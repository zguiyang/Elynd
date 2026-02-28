import { inject } from '@adonisjs/core'
import SystemConfig from '#models/system_config'
import UserConfig from '#models/user_config'
import { AI } from '#constants'
import type { AiClientConfig } from '#types/ai'
import type { UserLanguageConfig } from '#types/article'
import type { FullUserConfig } from '#types/article_generation'

@inject()
export class ConfigService {
  async getAiConfig(): Promise<AiClientConfig> {
    const config = await SystemConfig.first()

    return {
      baseUrl: config?.aiBaseUrl || '',
      apiKey: config?.aiApiKey || '',
      model: config?.aiModelName || '',
      timeout: AI.ARTICLE_GENERATION_TIMEOUT,
    }
  }

  async getUserLanguageConfig(userId: number): Promise<UserLanguageConfig> {
    const userConfig = await UserConfig.query().where('userId', userId).first()

    return {
      nativeLanguage: userConfig?.nativeLanguage || 'zh',
      targetLanguage: userConfig?.targetLanguage || 'en',
      englishVariant: userConfig?.englishVariant || 'en-US',
    }
  }

  async getFullUserConfig(userId: number): Promise<FullUserConfig> {
    const userConfig = await UserConfig.query().where('userId', userId).first()

    return {
      nativeLanguage: userConfig?.nativeLanguage || 'zh',
      targetLanguage: userConfig?.targetLanguage || 'en',
      englishVariant: userConfig?.englishVariant || 'en-US',
      vocabularyLevel: userConfig?.vocabularyLevel || 'intermediate',
    }
  }
}
