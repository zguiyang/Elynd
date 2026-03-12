import type { HttpContext } from '@adonisjs/core/http'

export interface SseWriter {
  send: (data: unknown) => void
  comment: (text: string) => void
  close: () => void
  isClosed: () => boolean
  onClose: (handler: () => void) => void
}

/**
 * Creates an SSE writer that writes directly to the HTTP response.
 * Handles protocol details: headers, framing, and connection state.
 *
 * Usage in controller:
 * ```ts
 * const sse = createSseWriter(ctx)
 * sse.comment('connected')
 * // ... write chunks
 * sse.send({ type: 'chunk', content: '...' })
 * sse.send({ type: 'done', content: '...', usage: {...} })
 * sse.close()
 * ```
 */
export function createSseWriter(ctx: HttpContext): SseWriter {
  const { response, request } = ctx

  response.header('Content-Type', 'text/event-stream')
  response.header('Cache-Control', 'no-cache')
  response.header('Connection', 'keep-alive')
  response.header('X-Accel-Buffering', 'no')

  const nodeResponse = response.response
  const rawRequest = request.request
  let closed = false
  let closeHandler: (() => void) | null = null

  response.relayHeaders()
  nodeResponse.flushHeaders()

  rawRequest.on('close', () => {
    closed = true
    if (closeHandler) {
      closeHandler()
    }
  })

  return {
    send: (data: unknown) => {
      if (closed || !nodeResponse || nodeResponse.writableEnded) return
      nodeResponse.write(`data: ${JSON.stringify(data)}\n\n`)
    },

    comment: (text: string) => {
      if (closed || !nodeResponse || nodeResponse.writableEnded) return
      nodeResponse.write(`: ${text}\n\n`)
    },

    close: () => {
      if (closed || !nodeResponse || nodeResponse.writableEnded) return
      closed = true
      nodeResponse.end()
    },

    isClosed: () => closed || !nodeResponse || nodeResponse.writableEnded,

    onClose: (handler: () => void) => {
      closeHandler = handler
    },
  }
}
