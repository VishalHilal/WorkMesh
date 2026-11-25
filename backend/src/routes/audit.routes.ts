import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../lib/db.js'
import { authenticate, getAuthenticatedCompanyId } from '../middleware/auth.middleware.js'
import { requireRole } from '../middleware/role.middleware.js'

const auditRouter = Router()

// All audit routes require authentication and Admin/Super Admin role
auditRouter.use(authenticate)
auditRouter.use(requireRole(Role.ADMIN, Role.SUPER_ADMIN))

const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  startDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
  endDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
})

/**
 * GET /api/v1/audit-logs
 * Fetch append-only audit trail for caller's company.
 * Strictly scoped to companyId. Restricted to ADMIN and SUPER_ADMIN.
 */
auditRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const parseResult = listAuditLogsQuerySchema.safeParse(req.query)

    if (!parseResult.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const { page, limit, action, entityType, userId, startDate, endDate } = parseResult.data
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      companyId, // strictly enforce tenant isolation
    }

    if (action) {
      where['action'] = action
    }

    if (entityType) {
      where['entityType'] = entityType
    }

    if (userId) {
      where['userId'] = userId
    }

    if (startDate || endDate) {
      where['createdAt'] = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ])

    const totalPages = Math.ceil(total / limit) || 1

    res.status(200).json({
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (err) {
    next(err)
  }
})

export { auditRouter }
