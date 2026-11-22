import { Router } from 'express'
import type { Request, Response } from 'express'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  res.json({
    data: { status: 'ok' },
    meta: { timestamp: new Date().toISOString() },
  })
})

export { router as healthRouter }
