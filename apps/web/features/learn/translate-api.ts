import {
  TRANSLATE_SSE_EVENT,
  type TranslateArticleBody,
  type TranslateSseDone,
  translateSseDoneSchema,
  translateSseErrorSchema,
  type TranslateSseMeta,
  translateSseMetaSchema,
  type TranslateSseSentence,
  translateSseSentenceSchema,
  type TranslateSseTitle,
  translateSseTitleSchema,
} from '@elynd/shared/api/translate';

import { ApiRequestError, formatApiError } from '@/lib/api-request';

export type TranslateStreamHandlers = {
  onMeta: (meta: TranslateSseMeta) => void;
  onTitle: (title: TranslateSseTitle) => void;
  onSentence: (sentence: TranslateSseSentence) => void;
  onDone: (done: TranslateSseDone) => void;
};

type ParsedSseFrame = { event?: string; data: string };

function parseSseFrames(chunk: string): { frames: ParsedSseFrame[]; rest: string } {
  const parts = chunk.split('\n\n');
  const rest = parts.pop() ?? '';
  const frames = parts
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      let event: string | undefined;
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) {
          event = line.slice('event:'.length).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trim());
        }
      }
      return { event, data: dataLines.join('\n') };
    });
  return { frames, rest };
}

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error?.trim()) {
      return body.error.trim();
    }
  } catch {
    // keep default
  }
  return '请求失败';
}

function parseJsonPayload(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    throw new ApiRequestError({ message: '响应格式无效', status: 502 });
  }
}

/**
 * POST /api/translate/article — consumes bilingual SSE (meta / title / sentence / done / error).
 */
export async function streamTranslateArticle(
  body: TranslateArticleBody,
  handlers: TranslateStreamHandlers,
  init?: { signal?: AbortSignal },
): Promise<void> {
  const response = await fetch('/api/translate/article', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: init?.signal,
  });

  if (!response.ok) {
    throw new ApiRequestError({
      message: await readApiErrorMessage(response),
      status: response.status,
    });
  }

  if (!response.body) {
    throw new ApiRequestError({ message: '响应格式无效', status: 502 });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let hasSeenDone = false;

  while (true) {
    const { done: isStreamDone, value } = await reader.read();
    if (isStreamDone) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseFrames(buffer);
    buffer = parsed.rest;

    for (const frame of parsed.frames) {
      if (frame.event === TRANSLATE_SSE_EVENT.meta) {
        const meta = translateSseMetaSchema.safeParse(parseJsonPayload(frame.data));
        if (!meta.success) {
          throw new ApiRequestError({ message: '响应格式无效', status: 502 });
        }
        handlers.onMeta(meta.data);
        continue;
      }

      if (frame.event === TRANSLATE_SSE_EVENT.title) {
        const title = translateSseTitleSchema.safeParse(parseJsonPayload(frame.data));
        if (!title.success) {
          throw new ApiRequestError({ message: '响应格式无效', status: 502 });
        }
        handlers.onTitle(title.data);
        continue;
      }

      if (frame.event === TRANSLATE_SSE_EVENT.sentence) {
        const sentence = translateSseSentenceSchema.safeParse(parseJsonPayload(frame.data));
        if (!sentence.success) {
          throw new ApiRequestError({ message: '响应格式无效', status: 502 });
        }
        handlers.onSentence(sentence.data);
        continue;
      }

      if (frame.event === TRANSLATE_SSE_EVENT.done) {
        const doneEvent = translateSseDoneSchema.safeParse(parseJsonPayload(frame.data));
        if (!doneEvent.success) {
          throw new ApiRequestError({ message: '响应格式无效', status: 502 });
        }
        hasSeenDone = true;
        handlers.onDone(doneEvent.data);
        continue;
      }

      if (frame.event === TRANSLATE_SSE_EVENT.error) {
        const errEvent = translateSseErrorSchema.safeParse(parseJsonPayload(frame.data));
        const message = errEvent.success ? errEvent.data.error : 'AI unavailable';
        throw new ApiRequestError({ message, status: 503 });
      }
    }
  }

  if (!hasSeenDone) {
    throw new ApiRequestError({ message: 'AI unavailable', status: 503 });
  }
}

export const formatTranslateApiError = formatApiError;

/** Learner-facing copy for bilingual translation failures. */
export function formatTranslateLearnerError(error: unknown): string {
  const message = formatApiError(error);
  if (/translate model not configured|assist model not configured/i.test(message)) {
    return '双语翻译尚未配置模型，请到管理后台「AI 配置」为「双语翻译」绑定默认模型';
  }
  if (/AI unavailable/i.test(message)) {
    return '翻译暂时不可用，请稍后重试';
  }
  return message;
}
