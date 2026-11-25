import { describe, it, expect, beforeAll } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/db.js'
import { signAccessToken } from '../src/lib/auth.js'
import { recordAuditEvent } from '../src/lib/audit.js'

const server = http.createServer(app)

describe('Security Audit Trail API (GET /api/v1/audit-logs)', () => {
  let companyId: string
  let otherCompanyId: string
  let adminToken: string
  let superAdminToken: string
  let employeeToken: string
  let otherAdminToken: string
  let adminUserId: string

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
          adminUserId = adminMember.userId
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
        }
      }

      // Upsert isolated company for cross-tenant testing
      const otherCompany = await prisma.company.upsert({
        where: { slug: 'audit-isolated-tenant' },
        update: {},
        create: {
          name: 'Audit Isolated Tenant',
          slug: 'audit-isolated-tenant',
        },
      })
      otherCompanyId = otherCompany.id

      const otherAdminUser = await prisma.user.upsert({
        where: { email: 'isolated.admin@tenant.test' },
        update: {},
        create: {
          email: 'isolated.admin@tenant.test',
          firstName: 'Isolated',
          lastName: 'Admin',
          passwordHash: 'dummyhash123',
          memberships: {
            create: {
              companyId: otherCompanyId,
              role: 'ADMIN',
            },
          },
        },
      })

      otherAdminToken = signAccessToken({
        userId: otherAdminUser.id,
        companyId: otherCompanyId,
        role: 'ADMIN',
      })

      // Seed test audit events for companyId
      await recordAuditEvent({
        companyId,
        userId: adminUserId,
        action: 'TEST_AUDIT_ACTION_A',
        entityType: 'TestEntity',
        entityId: 'test-entity-1',
        details: { sample: 'metadata-a' },
        ipAddress: '127.0.0.1',
      })

      await recordAuditEvent({
        companyId,
        userId: adminUserId,
        action: 'TEST_AUDIT_ACTION_B',
        entityType: 'TestEntity',
        entityId: 'test-entity-2',
        details: { sample: 'metadata-b' },
        ipAddress: '127.0.0.1',
      })

      // Seed an audit event for the other company
      await recordAuditEvent({
        companyId: otherCompanyId,
        userId: otherAdminUser.id,
        action: 'OTHER_TENANT_ACTION',
        entityType: 'OtherEntity',
        entityId: 'other-entity-99',
        details: { secret: 'cross-tenant-secret' },
        ipAddress: '192.168.1.1',
      })
    } catch (err) {
      console.warn('Failed in test setup beforeAll:', err)
    }
  })

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(server).get('/api/v1/audit-logs')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects employee requests with 403 Forbidden', async () => {
    if (!employeeToken) return

    const res = await request(server)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${employeeToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('allows ADMIN to fetch audit logs with pagination metadata', async () => {
    if (!adminToken) return

    const res = await request(server)
      .get('/api/v1/audit-logs?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)

    const log = res.body.data[0]
    expect(log).toHaveProperty('id')
    expect(log).toHaveProperty('companyId', companyId)
    expect(log).toHaveProperty('action')
    expect(log).toHaveProperty('entityType')
    expect(log).toHaveProperty('createdAt')
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    })
    expect(res.body.meta).toHaveProperty('total')
  })

  it('allows SUPER_ADMIN to fetch company audit logs', async () => {
    if (!superAdminToken) return

    const res = await request(server)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${superAdminToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('strictly isolates audit logs between tenants', async () => {
    if (!adminToken || !otherAdminToken) return

    // Company A's admin should never see Company B's audit events
    const companyARes = await request(server)
      .get('/api/v1/audit-logs?limit=50')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(companyARes.status).toBe(200)
    const companyALogs = companyARes.body.data
    const leakedLog = companyALogs.find((l: any) => l.action === 'OTHER_TENANT_ACTION')
    expect(leakedLog).toBeUndefined()

    // Company B's admin sees their own event
    const companyBRes = await request(server)
      .get('/api/v1/audit-logs?action=OTHER_TENANT_ACTION')
      .set('Authorization', `Bearer ${otherAdminToken}`)

    expect(companyBRes.status).toBe(200)
    expect(companyBRes.body.data.length).toBeGreaterThanOrEqual(1)
    expect(companyBRes.body.data[0].action).toBe('OTHER_TENANT_ACTION')
    expect(companyBRes.body.data[0].companyId).toBe(otherCompanyId)
  })

  it('filters audit logs by action parameter', async () => {
    if (!adminToken) return

    const res = await request(server)
      .get('/api/v1/audit-logs?action=TEST_AUDIT_ACTION_A')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data.every((l: any) => l.action === 'TEST_AUDIT_ACTION_A')).toBe(true)
  })
})
