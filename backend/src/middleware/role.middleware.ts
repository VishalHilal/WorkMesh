import type { Request, Response, NextFunction } from 'express'
import type { Role } from '@prisma/client'

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before checking permissions.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to perform this action.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    next()
  }
}
