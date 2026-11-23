import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { verifyAccessToken, type AccessTokenPayload } from '../lib/auth.js'

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Missing or malformed Authorization header.',
      },
      meta: { timestamp: new Date().toISOString() },
    })
    return
  }

  const token = authHeader.slice(7).trim()

  try {
    const payload = verifyAccessToken(token)
    req.user = payload
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid access token.',
      },
      meta: { timestamp: new Date().toISOString() },
    })
  }
}
