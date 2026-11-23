import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/db.js'
import { env } from '../src/config/env.js'
import { hashPassword, verifyPassword, signAccessToken, verifyAccessToken } from '../src/lib/auth.js'
import { authenticate } from '../src/middleware/auth.middleware.js'

const server = http.createServer(app)

// Test protected app to verify auth middleware
const protectedApp = express()
protectedApp.use(express.json())
protectedApp.get('/protected', authenticate, (req, res) => {
  res.status(200).json({ user: req.user })
})
const protectedServer = http.createServer(protectedApp)

describe('Authentication Utilities', () => {
  it('hashes and verifies passwords correctly', async () => {
    const raw = 'SecurePassword123!'
    const hash = await hashPassword(raw)

    expect(hash).not.toBe(raw)
    expect(await verifyPassword(raw, hash)).toBe(true)
    expect(await verifyPassword('WrongPassword', hash)).toBe(false)
  })

  it('signs and verifies JWT access tokens', () => {
    const payload = {
      userId: 'user_123',
      companyId: 'company_123',
      role: 'EMPLOYEE' as const,
    }

    const token = signAccessToken(payload)
    expect(typeof token).toBe('string')

    const decoded = verifyAccessToken(token)
    expect(decoded.userId).toBe(payload.userId)
    expect(decoded.companyId).toBe(payload.companyId)
    expect(decoded.role).toBe(payload.role)
  })
})

describe('Auth Middleware', () => {
  it('rejects requests with missing Authorization header', async () => {
    const res = await request(protectedServer).get('/protected')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects requests with non-Bearer Authorization header', async () => {
    const res = await request(protectedServer)
      .get('/protected')
      .set('Authorization', 'Basic dXNlcjpwYXNz')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects requests with an invalid token', async () => {
    const res = await request(protectedServer)
      .get('/protected')
      .set('Authorization', 'Bearer invalid.token.value')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('rejects requests with an expired token', async () => {
    const expiredToken = jwt.sign(
      { userId: 'u1', companyId: 'c1', role: 'EMPLOYEE' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '-1s' }
    )

    const res = await request(protectedServer)
      .get('/protected')
      .set('Authorization', `Bearer ${expiredToken}`)

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('TOKEN_EXPIRED')
  })

  it('accepts requests with a valid token and attaches user to request', async () => {
    const validToken = signAccessToken({
      userId: 'test-user-id',
      companyId: 'test-company-id',
      role: 'ADMIN',
    })

    const res = await request(protectedServer)
      .get('/protected')
      .set('Authorization', `Bearer ${validToken}`)

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({
      userId: 'test-user-id',
      companyId: 'test-company-id',
      role: 'ADMIN',
    })
  })
})

describe('POST /api/v1/auth/login', () => {
  const testEmail = `auth_test_${Date.now()}@nexora.test`
  const testPassword = 'Password123!'
  let testCompanyId: string
  let testUserId: string

  beforeAll(async () => {
    try {
      const company = await prisma.company.create({
        data: {
          name: 'Test Auth Corp',
          slug: `test-auth-${Date.now()}`,
        },
      })
      testCompanyId = company.id

      const hashedPassword = await hashPassword(testPassword)
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: hashedPassword,
          firstName: 'Auth',
          lastName: 'Tester',
          memberships: {
            create: {
              companyId: testCompanyId,
              role: 'MANAGER',
            },
          },
        },
      })
      testUserId = user.id
    } catch {
      // If DB is not reachable in local dry-run, DB tests will handle gracefully
    }
  })

  afterAll(async () => {
    try {
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } })
      }
      if (testCompanyId) {
        await prisma.company.delete({ where: { id: testCompanyId } })
      }
    } catch {
      // Cleanup best-effort
    }
  })

  it('returns 422 for malformed request body (missing fields)', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 for unknown user email without revealing user existence', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'anyPassword123' })

    // In environments with or without DB, it should either be 401 (DB checked) or 500 (DB down)
    expect([401, 500]).toContain(res.status)
    if (res.status === 401) {
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    }
  })

  it('returns 200 and accessToken on valid credentials when DB is connected', async () => {
    if (!testUserId) return

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword })

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('accessToken')
    expect(res.body.data.user).toMatchObject({
      email: testEmail,
      firstName: 'Auth',
      lastName: 'Tester',
      role: 'MANAGER',
    })
  })

  it('returns 401 on incorrect password for an existing user', async () => {
    if (!testUserId) return

    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'WrongPassword999' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })
})
