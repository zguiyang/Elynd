import { eq } from 'drizzle-orm';

import { ttsConfig as ttsConfigTable } from '@elynd/db';
import {
  DEFAULT_TTS_VOICES,
  type PutTtsConfigBody,
  type TestTtsBody,
  type TestTtsResult,
  TTS_PROVIDER_AZURE,
  TTS_VOICE_PRESETS,
  type TtsConfigView,
  type TtsVoicePreset,
  type TtsVoiceRole,
} from '@elynd/shared/api/tts';

import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { AppError } from '@/lib/errors';
import { decryptApiKey, encryptApiKey, maskApiKey } from '@/lib/llm';
import { synthesizeAzureTts } from '@/lib/tts';

export const TTS_CONFIG_ID = 'default';

type TtsConfigRow = typeof ttsConfigTable.$inferSelect;

export type SynthesizeTtsOptions = {
  text: string;
  voice?: string;
  role?: TtsVoiceRole;
  source: string;
  userId?: string;
};

export type SynthesizeTtsResult = {
  audio: Buffer;
  mimeType: string;
  voice: string;
  wordTimings: Array<{
    text: string;
    audioOffsetMs: number;
    durationMs: number;
    textOffset: number;
  }>;
};

function emptyConfigView(): TtsConfigView {
  return {
    configured: false,
    provider: TTS_PROVIDER_AZURE,
    region: '',
    isEnabled: false,
    apiKeySet: false,
    apiKeyMasked: null,
    defaultVoice: DEFAULT_TTS_VOICES.defaultVoice,
    usVoice: DEFAULT_TTS_VOICES.usVoice,
    ukVoice: DEFAULT_TTS_VOICES.ukVoice,
    updatedAt: null,
  };
}

function toConfigView(row: TtsConfigRow): TtsConfigView {
  let apiKeyMasked: string | null = null;
  try {
    apiKeyMasked = maskApiKey(decryptApiKey(row.apiKeyCiphertext));
  } catch {
    apiKeyMasked = '****';
  }
  return {
    configured: true,
    provider: TTS_PROVIDER_AZURE,
    region: row.region,
    isEnabled: row.isEnabled,
    apiKeySet: true,
    apiKeyMasked,
    defaultVoice: row.defaultVoice,
    usVoice: row.usVoice,
    ukVoice: row.ukVoice,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadConfigRow(): Promise<TtsConfigRow | null> {
  const rows = await db.select().from(ttsConfigTable).where(eq(ttsConfigTable.id, TTS_CONFIG_ID)).limit(1);
  return rows[0] ?? null;
}

function resolveVoice(row: TtsConfigRow, options: { voice?: string; role?: TtsVoiceRole }): string {
  if (options.voice?.trim()) {
    return options.voice.trim();
  }
  if (options.role === 'us') {
    return row.usVoice;
  }
  if (options.role === 'uk') {
    return row.ukVoice;
  }
  return row.defaultVoice;
}

export function listVoicePresets(): TtsVoicePreset[] {
  return TTS_VOICE_PRESETS.map((preset) => ({ ...preset }));
}

export async function getConfig(): Promise<TtsConfigView> {
  const row = await loadConfigRow();
  return row ? toConfigView(row) : emptyConfigView();
}

export async function putConfig(body: PutTtsConfigBody): Promise<TtsConfigView> {
  const existing = await loadConfigRow();
  if (!existing && !body.apiKey?.trim()) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, 'API key is required for first-time TTS setup');
  }

  const apiKeyCiphertext = body.apiKey?.trim() ? encryptApiKey(body.apiKey.trim()) : existing!.apiKeyCiphertext;

  const [row] = await db
    .insert(ttsConfigTable)
    .values({
      id: TTS_CONFIG_ID,
      provider: TTS_PROVIDER_AZURE,
      region: body.region,
      apiKeyCiphertext,
      isEnabled: body.isEnabled,
      defaultVoice: body.defaultVoice,
      usVoice: body.usVoice,
      ukVoice: body.ukVoice,
    })
    .onConflictDoUpdate({
      target: ttsConfigTable.id,
      set: {
        region: body.region,
        apiKeyCiphertext,
        isEnabled: body.isEnabled,
        defaultVoice: body.defaultVoice,
        usVoice: body.usVoice,
        ukVoice: body.ukVoice,
      },
    })
    .returning();

  return toConfigView(row!);
}

/**
 * Global TTS entry for admin and future learner flows.
 * Loads dynamic config, resolves voice, then calls the Azure adapter.
 */
export async function synthesizeTts(options: SynthesizeTtsOptions): Promise<SynthesizeTtsResult> {
  const row = await loadConfigRow();
  if (!row) {
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'TTS is not configured');
  }
  if (!row.isEnabled) {
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'TTS is disabled');
  }
  if (row.provider !== TTS_PROVIDER_AZURE) {
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'Unsupported TTS provider');
  }

  let subscriptionKey: string;
  try {
    subscriptionKey = decryptApiKey(row.apiKeyCiphertext);
  } catch {
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'TTS credentials are invalid');
  }

  const voice = resolveVoice(row, options);
  const synthesized = await synthesizeAzureTts({
    subscriptionKey,
    region: row.region,
    voice,
    text: options.text,
  });

  return {
    audio: synthesized.audio,
    mimeType: synthesized.mimeType,
    voice,
    wordTimings: synthesized.wordTimings,
  };
}

export async function testTts(body: TestTtsBody): Promise<TestTtsResult> {
  const started = Date.now();
  const result = await synthesizeTts({
    text: body.text,
    role: body.role,
    voice: body.voice,
    source: 'admin.tts_test',
  });

  return {
    ok: true,
    latencyMs: Date.now() - started,
    voice: result.voice,
    mimeType: result.mimeType,
    audioBase64: result.audio.toString('base64'),
    wordTimings: result.wordTimings,
  };
}
