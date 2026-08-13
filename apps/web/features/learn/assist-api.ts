import {
  ASSIST_SSE_EVENT,
  type AssistAskBody,
  assistSseDeltaSchema,
  type AssistSseDone,
  assistSseDoneSchema,
  assistSseErrorSchema,
} from '@elynd/shared/api/assist';

import { ApiRequestError, formatApiError } from '@/lib/api-request';

export type AssistStreamHandlers = {
  onDelta: (text: string) => void;
  onDone: (done: AssistSseDone) => void;
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

/**
 * POST /api/assist/ask — consumes lightweight SSE (delta / done / error).
 */
export async function askAssistStream(
  body: AssistAskBody,
  handlers: AssistStreamHandlers,
  init?: { signal?: AbortSignal },
): Promise<void> {
  const response = await fetch('/api/assist/ask', {
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
      if (frame.event === ASSIST_SSE_EVENT.delta) {
        let payload: unknown;
        try {
          payload = JSON.parse(frame.data) as unknown;
        } catch {
          throw new ApiRequestError({ message: '响应格式无效', status: 502 });
        }
        const delta = assistSseDeltaSchema.safeParse(payload);
        if (!delta.success) {
          throw new ApiRequestError({ message: '响应格式无效', status: 502 });
        }
        if (delta.data.text) {
          handlers.onDelta(delta.data.text);
        }
        continue;
      }

      if (frame.event === ASSIST_SSE_EVENT.done) {
        let payload: unknown;
        try {
          payload = JSON.parse(frame.data) as unknown;
        } catch {
          throw new ApiRequestError({ message: '响应格式无效', status: 502 });
        }
        const doneEvent = assistSseDoneSchema.safeParse(payload);
        if (!doneEvent.success) {
          throw new ApiRequestError({ message: '响应格式无效', status: 502 });
        }
        hasSeenDone = true;
        handlers.onDone(doneEvent.data);
        continue;
      }

      if (frame.event === ASSIST_SSE_EVENT.error) {
        let payload: unknown;
        try {
          payload = JSON.parse(frame.data) as unknown;
        } catch {
          throw new ApiRequestError({ message: '响应格式无效', status: 502 });
        }
        const errEvent = assistSseErrorSchema.safeParse(payload);
        const message = errEvent.success ? errEvent.data.error : 'AI unavailable';
        throw new ApiRequestError({ message, status: 503 });
      }
    }
  }

  if (!hasSeenDone) {
    throw new ApiRequestError({ message: 'AI unavailable', status: 503 });
  }
}

export const formatAssistApiError = formatApiError;

/** Learner-facing copy for assist failures (API messages stay English). */
export function formatAssistLearnerError(error: unknown): string {
  const message = formatApiError(error);
  if (/model not configured/i.test(message)) {
    return '阅读助手尚未配置模型，请到管理后台「AI 配置」为「阅读助手」绑定默认模型';
  }
  if (/AI unavailable/i.test(message)) {
    return 'AI 暂时不可用，请稍后重试或检查模型配置';
  }
  return message;
}
