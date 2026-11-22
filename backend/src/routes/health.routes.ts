import { Router } from 'express'
import type { Request, Response } from 'express'
import { prisma } from '../lib/db.js'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  let dbStatus: 'ok' | 'error' = 'error'

  try {
    await prisma.$queryRaw`SELECT 1`
    dbStatus = 'ok'
  } catch {
    dbStatus = 'error'
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded'
  const httpStatus = dbStatus === 'ok' ? 200 : 503

  res.status(httpStatus).json({
    data: {
      status,
      services: { database: dbStatus },
    },
    meta: { timestamp: new Date().toISOString() },
  })
})

export { router as healthRouter }
