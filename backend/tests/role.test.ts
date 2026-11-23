import { describe, it, expect } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../src/app.js'
import { env } from '../src/config/env.js'
import { signAccessToken } from '../src/lib/auth.js'

const server = http.createServer(app)

describe('Role-Based Authorization & Tenant Scoping', () => {
  const companyA = 'company_alpha_123'
  const companyB = 'company_beta_456'

  const employeeToken = signAccessToken({
    userId: 'user_emp',
    companyId: companyA,
    role: 'EMPLOYEE',
  })

  const managerToken = signAccessToken({
    userId: 'user_mgr',
    companyId: companyA,
    role: 'MANAGER',
  })

  const adminToken = signAccessToken({
    userId: 'user_adm',
    companyId: companyA,
    role: 'ADMIN',
  })

  const superAdminToken = signAccessToken({
    userId: 'user_super',
    companyId: companyA,
    role: 'SUPER_ADMIN',
  })

  describe('Authentication Gate (/api/v1/auth/me)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(server).get('/api/v1/auth/me')

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })

    it('rejects requests with invalid tokens with 401', async () => {
      const res = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload')

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_TOKEN')
    })

    it('rejects requests with expired tokens with 401', async () => {
      const expiredToken = jwt.sign(
        { userId: 'u1', companyId: companyA, role: 'EMPLOYEE' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '-1s' }
      )

      const res = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('TOKEN_EXPIRED')
    })

    it('allows authenticated requests and returns user context', async () => {
      const res = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${employeeToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.user).toMatchObject({
        userId: 'user_emp',
        companyId: companyA,
        role: 'EMPLOYEE',
      })
    })
  })

  describe('Role-Based Enforcement (/api/v1/auth/admin-only)', () => {
    it('forbids EMPLOYEE role from accessing admin route (403)', async () => {
      const res = await request(server)
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${employeeToken}`)

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
      expect(res.body.error.message).toContain('Insufficient permissions')
    })

    it('forbids MANAGER role from accessing admin route (403)', async () => {
      const res = await request(server)
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${managerToken}`)

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    it('grants access to ADMIN role (200)', async () => {
      const res = await request(server)
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.message).toBe('Admin access granted.')
    })

    it('grants access to SUPER_ADMIN role (200)', async () => {
      const res = await request(server)
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${superAdminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.message).toBe('Admin access granted.')
    })
  })

  describe('Multi-Tenant Company Scoping & Isolation', () => {
    it('allows access to resources belonging to the authenticated company', async () => {
      const res = await request(server)
        .get(`/api/v1/auth/company-resource/${companyA}`)
        .set('Authorization', `Bearer ${employeeToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.companyId).toBe(companyA)
    })

    it('strictly forbids access when attempting cross-company resource access (403)', async () => {
      const res = await request(server)
        .get(`/api/v1/auth/company-resource/${companyB}`)
        .set('Authorization', `Bearer ${employeeToken}`)

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
      expect(res.body.error.message).toContain('Cross-company access denied')
    })
  })
})
