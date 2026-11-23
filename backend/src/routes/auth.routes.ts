import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/db.js'
import { verifyPassword, signAccessToken } from '../lib/auth.js'

const authRouter = Router()

// Rate limiting on login: 5 attempts per 15 minutes (50 in test mode)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env['NODE_ENV'] === 'test' ? 50 : 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts. Please try again later.',
    },
    meta: { timestamp: new Date().toISOString() },
  },
})

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

authRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const parseResult = loginSchema.safeParse(req.body)
    if (!parseResult.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body.',
          details: parseResult.error.flatten().fieldErrors,
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const { email, password } = parseResult.data

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          include: {
            company: true,
          },
        },
      },
    })

    if (!user || !user.isActive) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const primaryMembership = user.memberships.find((m) => m.company.isActive)
    if (!primaryMembership) {
      res.status(401).json({
        error: {
          code: 'NO_ACTIVE_COMPANY',
          message: 'User does not belong to an active company.',
        },
        meta: { timestamp: new Date().toISOString() },
      })
      return
    }

    const accessToken = signAccessToken({
      userId: user.id,
      companyId: primaryMembership.companyId,
      role: primaryMembership.role,
    })

    res.status(200).json({
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyId: primaryMembership.companyId,
          role: primaryMembership.role,
        },
      },
      meta: { timestamp: new Date().toISOString() },
    })
  } catch (error) {
    next(error)
  }
})

export { authRouter }
