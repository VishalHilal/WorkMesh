import { Router } from 'express'
import type { Request, Response } from 'express'
import { prisma } from '../lib/db.js'
import { env } from '../config/env.js'

const router = Router()

async function checkDatabase(): Promise<'ok' | 'error'> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkAiService(): Promise<'ok' | 'error'> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000)

  try {
    const res = await fetch(`${env.AI_SERVICE_URL}/api/v1/health`, {
      method: 'GET',
      signal: controller.signal,
    })
    return res.ok ? 'ok' : 'error'
  } catch {
    return 'error'
  } finally {
    clearTimeout(timeoutId)
  }
}

router.get('/', async (_req: Request, res: Response) => {
  const dbStatus = await checkDatabase()
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

router.get('/ready', async (_req: Request, res: Response) => {
  const [database, aiService] = await Promise.all([checkDatabase(), checkAiService()])
  const allReady = database === 'ok' && aiService === 'ok'

  res.status(allReady ? 200 : 503).json({
    data: {
      status: allReady ? 'ok' : 'degraded',
      services: { database, aiService },
    },
    meta: { timestamp: new Date().toISOString() },
  })
})

export { router as healthRouter }
