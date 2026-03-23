import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import SystemConfig from '#models/system_config'
import { UserConfigService } from '#services/user/user_config_service'
import { AI } from '#constants'
import type { AiClientConfig } from '#types/ai'
import type { UserLanguageConfig } from '#types/book'

export interface SystemConfigSummary {
  aiBaseUrl: string | null
  aiModelName: string | null
  hasApiKey: boolean
}

export interface UpdateSystemConfigInput {
  aiBaseUrl?: string
  aiApiKey?: string
  aiModelName?: string
}

@inject()
export class ConfigService {
  constructor(private userConfigService: UserConfigService) {}

  async getSystemConfigSummary(): Promise<SystemConfigSummary> {
    const config = await this.getOrCreateSystemConfig()

    return {
      aiBaseUrl: config.aiBaseUrl,
      aiModelName: config.aiModelName,
      hasApiKey: !!config.aiApiKey,
    }
  }

  async updateSystemConfig(input: UpdateSystemConfigInput): Promise<SystemConfigSummary> {
    const config = await this.getOrCreateSystemConfig()
    const updates: Record<string, string | null> = {}

    if (input.aiBaseUrl !== undefined) {
      updates.aiBaseUrl = input.aiBaseUrl || null
    }
    if (input.aiApiKey !== undefined) {
      updates.aiApiKey = input.aiApiKey || null
    }
    if (input.aiModelName !== undefined) {
      updates.aiModelName = input.aiModelName || null
    }

    if (Object.keys(updates).length > 0) {
      config.merge(updates)
      await config.save()
    }

    return {
      aiBaseUrl: config.aiBaseUrl,
      aiModelName: config.aiModelName,
      hasApiKey: !!config.aiApiKey,
    }
  }

  async getAiConfig(): Promise<AiClientConfig> {
    const config = await SystemConfig.first()

    if (!config?.aiBaseUrl || !config?.aiApiKey || !config?.aiModelName) {
      throw new Exception('AI configuration is not properly configured', { status: 500 })
    }

    return {
      baseUrl: config.aiBaseUrl,
      apiKey: config.aiApiKey,
      model: config.aiModelName,
      timeout: AI.DEFAULT_TIMEOUT,
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

  private async getOrCreateSystemConfig() {
    const existing = await SystemConfig.first()
    if (existing) {
      return existing
    }

    return SystemConfig.create({
      aiBaseUrl: null,
      aiApiKey: null,
      aiModelName: null,
    })
  }
}
