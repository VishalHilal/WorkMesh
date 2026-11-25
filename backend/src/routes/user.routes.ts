import { Router } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../lib/db.js'
import { authenticate, getAuthenticatedCompanyId } from '../middleware/auth.middleware.js'
import { requireRole } from '../middleware/role.middleware.js'
import { recordAuditEvent } from '../lib/audit.js'

const usersRouter = Router()

// All user management routes require authentication
usersRouter.use(authenticate)

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
})

// GET /api/v1/users — list company employees
usersRouter.get('/', async (req, res, next) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const query = listUsersQuerySchema.safeParse(req.query)

    if (!query.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters.',
          details: query.error.flatten().fieldErrors,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const { page, limit, search, role } = query.data
    const skip = (page - 1) * limit

    // Search filter across firstName, lastName, email
    const searchFilter = search?.trim()
      ? {
          OR: [
            { firstName: { contains: search.trim(), mode: 'insensitive' as const } },
            { lastName: { contains: search.trim(), mode: 'insensitive' as const } },
            { email: { contains: search.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {}

    // Membership condition scoped to caller's company and optional role
    const membershipCondition = {
      companyId,
      ...(role ? { role } : {}),
    }

    const where = {
      ...searchFilter,
      memberships: {
        some: membershipCondition,
      },
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          memberships: {
            where: { companyId },
            select: { role: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ])

    const formattedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      role: u.memberships[0]?.role ?? Role.EMPLOYEE,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }))

    res.status(200).json({
      data: formattedUsers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/v1/users/:id — get user by ID scoped to company
usersRouter.get('/:id', async (req, res, next) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const id = req.params.id as string

    const user = await prisma.user.findFirst({
      where: {
        id,
        memberships: {
          some: { companyId },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          where: { companyId },
          select: { role: true },
        },
      },
    })

    if (!user) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found in this company.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    res.status(200).json({
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        role: user.memberships[0]?.role ?? Role.EMPLOYEE,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (error) {
    next(error)
  }
})

const updateRoleSchema = z.object({
  role: z.nativeEnum(Role, {
    message: 'Invalid role. Must be EMPLOYEE, MANAGER, ADMIN, or SUPER_ADMIN.',
  }),
})

// PATCH /api/v1/users/:id/role — update user role (ADMIN or SUPER_ADMIN only)
usersRouter.patch('/:id/role', requireRole(Role.ADMIN, Role.SUPER_ADMIN), async (req, res, next) => {
  try {
    const companyId = getAuthenticatedCompanyId(req)
    const caller = req.user!
    const targetUserId = req.params.id as string

    const parseResult = updateRoleSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid role update payload.',
          details: parseResult.error.flatten().fieldErrors,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const { role: newRole } = parseResult.data

    // Rule 1: Cannot modify own role (prevents self-demotion or accidental lockout)
    if (caller.userId === targetUserId) {
      res.status(400).json({
        error: {
          code: 'CANNOT_MODIFY_OWN_ROLE',
          message: 'You cannot modify your own role.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    // Rule 2: Only SUPER_ADMIN can assign SUPER_ADMIN role
    if (newRole === Role.SUPER_ADMIN && caller.role !== Role.SUPER_ADMIN) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only super administrators can promote users to super administrator.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    // Find target user's membership in this company
    const targetMembership = await prisma.membership.findUnique({
      where: {
        userId_companyId: {
          userId: targetUserId,
          companyId,
        },
      },
      include: {
        user: true,
      },
    })

    if (!targetMembership) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found in this company.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    // Rule 3: Only SUPER_ADMIN can demote/modify an existing SUPER_ADMIN
    if (targetMembership.role === Role.SUPER_ADMIN && caller.role !== Role.SUPER_ADMIN) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only super administrators can modify a super administrator account.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    // Update role
    const updatedMembership = await prisma.membership.update({
      where: {
        userId_companyId: {
          userId: targetUserId,
          companyId,
        },
      },
      data: {
        role: newRole,
      },
    })

    // Structured Audit Event Logging
    void recordAuditEvent({
      companyId,
      userId: caller.userId,
      action: 'USER_ROLE_CHANGED',
      entityType: 'User',
      entityId: targetUserId,
      details: {
        previousRole: targetMembership.role,
        newRole,
        targetEmail: targetMembership.user.email,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
    })

    console.info(
      JSON.stringify({
        event: 'AUDIT_USER_ROLE_CHANGED',
        companyId,
        targetUserId,
        previousRole: targetMembership.role,
        newRole,
        performedBy: caller.userId,
        timestamp: new Date().toISOString(),
      })
    )

    res.status(200).json({
      data: {
        id: targetMembership.user.id,
        email: targetMembership.user.email,
        firstName: targetMembership.user.firstName,
        lastName: targetMembership.user.lastName,
        isActive: targetMembership.user.isActive,
        role: updatedMembership.role,
        updatedAt: updatedMembership.updatedAt,
      },
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (error) {
    next(error)
  }
})

export { usersRouter }
