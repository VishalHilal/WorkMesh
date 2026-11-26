import type { Request, Response, NextFunction } from 'express'

interface AppError extends Error {
  status?: number
  statusCode?: number
}

export function errorMiddleware(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.status ?? err.statusCode ?? 500
  const message =
    process.env['NODE_ENV'] === 'production' && statusCode >= 500
      ? 'An unexpected error occurred.'
      : (err.message ?? 'An unexpected error occurred.')

  res.status(statusCode).json({
    error: {
      code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      message,
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...(req.requestId ? { requestId: req.requestId } : {}),
    },
  })
}
