import { randomUUID } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'

declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}

/**
 * Attach a unique X-Request-Id correlation identifier to each request/response
 * and emit structured JSON completion logs without sensitive headers or bodies.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id']
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming
  const requestId =
    typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate.trim().slice(0, 128)
      : randomUUID()

  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  const startedAt = Date.now()
  res.on('finish', () => {
    if (process.env['NODE_ENV'] === 'test') return
    console.info(
      JSON.stringify({
        event: 'HTTP_REQUEST',
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      })
    )
  })

  next()
}
