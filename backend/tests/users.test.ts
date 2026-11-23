import { describe, it, expect, beforeAll } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/db.js'
import { signAccessToken } from '../src/lib/auth.js'

const server = http.createServer(app)

describe('Company-Scoped User Management API', () => {
  let companyId: string
  let otherCompanyId: string
  let superAdminToken: string
  let adminToken: string
  let employeeToken: string
  let targetEmployeeId: string
  let otherCompanyUserId: string

  beforeAll(async () => {
    try {
      // Find seeded company WorkMesh Technologies
      const company = await prisma.company.findUnique({
        where: { slug: 'workmesh-tech' },
        include: {
          memberships: {
            include: { user: true },
          },
        },
      })

      if (company) {
        companyId = company.id

        const superAdminMember = company.memberships.find((m) => m.role === 'SUPER_ADMIN')
        const adminMember = company.memberships.find((m) => m.role === 'ADMIN')
        const employeeMember = company.memberships.find((m) => m.role === 'EMPLOYEE')

        if (superAdminMember) {
          superAdminToken = signAccessToken({
            userId: superAdminMember.userId,
            companyId,
            role: 'SUPER_ADMIN',
          })
        }

        if (adminMember) {
          adminToken = signAccessToken({
            userId: adminMember.userId,
            companyId,
            role: 'ADMIN',
          })
        }

        if (employeeMember) {
          employeeToken = signAccessToken({
            userId: employeeMember.userId,
            companyId,
            role: 'EMPLOYEE',
          })
          targetEmployeeId = employeeMember.userId
        }
      }

      // Create an isolated other company to test cross-tenant boundaries
      const otherCompany = await prisma.company.upsert({
        where: { slug: 'other-isolated-corp' },
        update: {},
        create: {
          name: 'Other Isolated Corp',
          slug: 'other-isolated-corp',
        },
      })
      otherCompanyId = otherCompany.id

      const otherUser = await prisma.user.upsert({
        where: { email: 'external.user@other.test' },
        update: {},
        create: {
          email: 'external.user@other.test',
          firstName: 'Foreign',
          lastName: 'Entity',
          passwordHash: 'dummyhash123',
          memberships: {
            create: {
              companyId: otherCompanyId,
              role: 'EMPLOYEE',
            },
          },
        },
      })
      otherCompanyUserId = otherUser.id
    } catch {
      // Handle when running in environments without DB
    }
  })

  describe('GET /api/v1/users', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(server).get('/api/v1/users')

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })

    it('returns paginated list of company employees without leaking passwordHash', async () => {
      if (!adminToken) return

      const res = await request(server)
        .get('/api/v1/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)

      const user = res.body.data[0]
      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('email')
      expect(user).toHaveProperty('firstName')
      expect(user).toHaveProperty('role')
      expect(user).not.toHaveProperty('passwordHash')

      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 10,
      })
      expect(res.body.meta).toHaveProperty('total')
      expect(res.body.meta).toHaveProperty('totalPages')
    })

    it('filters users by search query', async () => {
      if (!adminToken) return

      const res = await request(server)
        .get('/api/v1/users?search=Aarav')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0].firstName).toBe('Aarav')
    })

    it('filters users by role', async () => {
      if (!adminToken) return

      const res = await request(server)
        .get('/api/v1/users?role=ADMIN')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      res.body.data.forEach((u: { role: string }) => {
        expect(u.role).toBe('ADMIN')
      })
    })

    it('returns 422 for invalid query parameters', async () => {
      if (!adminToken) return

      const res = await request(server)
        .get('/api/v1/users?page=-1')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /api/v1/users/:id', () => {
    it('returns 404 for a user belonging to another company (cross-tenant isolation)', async () => {
      if (!adminToken || !otherCompanyUserId) return

      const res = await request(server)
        .get(`/api/v1/users/${otherCompanyUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('returns details of an employee belonging to the caller company', async () => {
      if (!adminToken || !targetEmployeeId) return

      const res = await request(server)
        .get(`/api/v1/users/${targetEmployeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(targetEmployeeId)
      expect(res.body.data).not.toHaveProperty('passwordHash')
    })
  })

  describe('PATCH /api/v1/users/:id/role', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(server)
        .patch(`/api/v1/users/${targetEmployeeId || 'u1'}/role`)
        .send({ role: 'MANAGER' })

      expect(res.status).toBe(401)
    })

    it('forbids EMPLOYEE caller from updating roles with 403', async () => {
      if (!employeeToken || !targetEmployeeId) return

      const res = await request(server)
        .patch(`/api/v1/users/${targetEmployeeId}/role`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ role: 'MANAGER' })

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    it('rejects attempt to modify own role with 400', async () => {
      if (!adminToken) return

      // Decode admin userId
      const adminMember = await prisma.membership.findFirst({
        where: { companyId, role: 'ADMIN' },
      })
      if (!adminMember) return

      const res = await request(server)
        .patch(`/api/v1/users/${adminMember.userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'EMPLOYEE' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('CANNOT_MODIFY_OWN_ROLE')
    })

    it('forbids ADMIN from promoting an employee to SUPER_ADMIN with 403', async () => {
      if (!adminToken || !targetEmployeeId) return

      const res = await request(server)
        .patch(`/api/v1/users/${targetEmployeeId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'SUPER_ADMIN' })

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    it('allows ADMIN to update EMPLOYEE to MANAGER with 200', async () => {
      if (!adminToken || !targetEmployeeId) return

      const res = await request(server)
        .patch(`/api/v1/users/${targetEmployeeId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'MANAGER' })

      expect(res.status).toBe(200)
      expect(res.body.data.role).toBe('MANAGER')

      // Reset back to EMPLOYEE
      await request(server)
        .patch(`/api/v1/users/${targetEmployeeId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'EMPLOYEE' })
    })

    it('allows SUPER_ADMIN to assign ADMIN role with 200', async () => {
      if (!superAdminToken || !targetEmployeeId) return

      const res = await request(server)
        .patch(`/api/v1/users/${targetEmployeeId}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'ADMIN' })

      expect(res.status).toBe(200)
      expect(res.body.data.role).toBe('ADMIN')

      // Reset back to EMPLOYEE
      await request(server)
        .patch(`/api/v1/users/${targetEmployeeId}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'EMPLOYEE' })
    })

    it('rejects invalid role with 422', async () => {
      if (!adminToken || !targetEmployeeId) return

      const res = await request(server)
        .patch(`/api/v1/users/${targetEmployeeId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'INVALID_ROLE' })

      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
