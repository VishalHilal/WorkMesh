import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/db.js'
import { signAccessToken } from '../src/lib/auth.js'
import { Role, DocumentStatus } from '@prisma/client'

// Mock Neon Object Storage operations for API controller tests
vi.mock('../src/lib/storage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/storage.js')>()
  return {
    ...actual,
    uploadObject: vi.fn().mockResolvedValue({ $metadata: { httpStatusCode: 200 } }),
    deleteObject: vi.fn().mockResolvedValue({ $metadata: { httpStatusCode: 204 } }),
    getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://mock-neon-storage.local/presigned-download-url'),
  }
})

const server = http.createServer(app)

describe('Document Upload and Management API', () => {
  let isDbConnected = false

  let companyAId = 'test_company_a'
  let companyBId = 'test_company_b'
  let adminUserId = 'test_admin_user_a'
  let employeeUserId = 'test_employee_user_a'
  let employeeBId = 'test_employee_user_b'

  let adminUserToken = signAccessToken({
    userId: adminUserId,
    companyId: companyAId,
    role: Role.ADMIN,
  })

  let employeeUserToken = signAccessToken({
    userId: employeeUserId,
    companyId: companyAId,
    role: Role.EMPLOYEE,
  })

  let employeeBToken = signAccessToken({
    userId: employeeBId,
    companyId: companyBId,
    role: Role.EMPLOYEE,
  })

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`
      isDbConnected = true

      // Find or use seeded companies and users
      const companyA = await prisma.company.upsert({
        where: { slug: 'doc-test-company-a' },
        create: {
          name: 'Doc Test Company A',
          slug: 'doc-test-company-a',
        },
        update: {},
      })
      companyAId = companyA.id

      const companyB = await prisma.company.upsert({
        where: { slug: 'doc-test-company-b' },
        create: {
          name: 'Doc Test Company B',
          slug: 'doc-test-company-b',
        },
        update: {},
      })
      companyBId = companyB.id

      const adminUser = await prisma.user.upsert({
        where: { email: 'doc.admin@company-a.test' },
        create: {
          email: 'doc.admin@company-a.test',
          passwordHash: 'dummyhash',
          firstName: 'Admin',
          lastName: 'CompanyA',
          memberships: {
            create: {
              companyId: companyAId,
              role: Role.ADMIN,
            },
          },
        },
        update: {},
      })
      adminUserId = adminUser.id

      const employeeUser = await prisma.user.upsert({
        where: { email: 'doc.employee@company-a.test' },
        create: {
          email: 'doc.employee@company-a.test',
          passwordHash: 'dummyhash',
          firstName: 'Employee',
          lastName: 'CompanyA',
          memberships: {
            create: {
              companyId: companyAId,
              role: Role.EMPLOYEE,
            },
          },
        },
        update: {},
      })
      employeeUserId = employeeUser.id

      const employeeB = await prisma.user.upsert({
        where: { email: 'doc.employee@company-b.test' },
        create: {
          email: 'doc.employee@company-b.test',
          passwordHash: 'dummyhash',
          firstName: 'Employee',
          lastName: 'CompanyB',
          memberships: {
            create: {
              companyId: companyBId,
              role: Role.EMPLOYEE,
            },
          },
        },
        update: {},
      })
      employeeBId = employeeB.id

      adminUserToken = signAccessToken({
        userId: adminUserId,
        companyId: companyAId,
        role: Role.ADMIN,
      })

      employeeUserToken = signAccessToken({
        userId: employeeUserId,
        companyId: companyAId,
        role: Role.EMPLOYEE,
      })

      employeeBToken = signAccessToken({
        userId: employeeBId,
        companyId: companyBId,
        role: Role.EMPLOYEE,
      })
    } catch {
      isDbConnected = false
    }
  }, 30000)

  afterAll(async () => {
    if (!isDbConnected) return
    try {
      await prisma.document.deleteMany({
        where: {
          companyId: { in: [companyAId, companyBId] },
        },
      })
    } catch {
      // Ignore cleanup error
    }
  })

  describe('POST /api/v1/documents/upload', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const res = await request(server).post('/api/v1/documents/upload')
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 400 when no file is uploaded', async () => {
      const res = await request(server)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${employeeUserToken}`)

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('FILE_REQUIRED')
    })

    it('returns 400 when an unsupported file type is uploaded', async () => {
      const res = await request(server)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .attach('file', Buffer.from('fake image data'), {
          filename: 'avatar.png',
          contentType: 'image/png',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE')
    })

    it('successfully uploads a valid PDF document and returns 201', async () => {
      if (!isDbConnected) return

      const fileContent = '%PDF-1.4 sample pdf content for testing'
      const res = await request(server)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .field('title', 'Company Policy PDF')
        .attach('file', Buffer.from(fileContent), {
          filename: 'company_policy.pdf',
          contentType: 'application/pdf',
        })

      expect(res.status).toBe(201)
      expect(res.body.data).toBeDefined()
      expect(res.body.data.title).toBe('Company Policy PDF')
      expect(res.body.data.fileName).toBe('company_policy.pdf')
      expect(res.body.data.mimeType).toBe('application/pdf')
      expect(res.body.data.status).toBe(DocumentStatus.PENDING)
      expect(res.body.data.companyId).toBe(companyAId)
      expect(res.body.data.uploadedById).toBe(employeeUserId)
      expect(res.body.data.storageKey).toContain(`documents/${companyAId}/`)
    })

    it('successfully uploads a plain text file with default title from filename', async () => {
      if (!isDbConnected) return

      const fileContent = 'Plain text notes and documentation.'
      const res = await request(server)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .attach('file', Buffer.from(fileContent), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })

      expect(res.status).toBe(201)
      expect(res.body.data.title).toBe('notes.txt')
      expect(res.body.data.mimeType).toBe('text/plain')
      expect(res.body.data.companyId).toBe(companyAId)
    })
  })

  describe('GET /api/v1/documents', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(server).get('/api/v1/documents')
      expect(res.status).toBe(401)
    })

    it('returns 422 for invalid query parameters', async () => {
      const res = await request(server)
        .get('/api/v1/documents?page=-1')
        .set('Authorization', `Bearer ${employeeUserToken}`)

      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns company documents and pagination metadata', async () => {
      if (!isDbConnected) return

      const res = await request(server)
        .get('/api/v1/documents?page=1&limit=10')
        .set('Authorization', `Bearer ${employeeUserToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 10,
      })
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1)
    })

    it('enforces multi-tenant isolation (company B sees 0 company A documents)', async () => {
      if (!isDbConnected) return

      const res = await request(server)
        .get('/api/v1/documents')
        .set('Authorization', `Bearer ${employeeBToken}`)

      expect(res.status).toBe(200)
      const docs = res.body.data
      const companyADocs = docs.filter((d: { companyId: string }) => d.companyId === companyAId)
      expect(companyADocs.length).toBe(0)
    })
  })

  describe('GET /api/v1/documents/:id', () => {
    it('returns 404 for a non-existent document ID', async () => {
      if (!isDbConnected) return

      const res = await request(server)
        .get('/api/v1/documents/non-existent-id')
        .set('Authorization', `Bearer ${employeeUserToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('returns document details with presigned download URL', async () => {
      if (!isDbConnected) return

      // Fetch list to get an existing document id
      const listRes = await request(server)
        .get('/api/v1/documents')
        .set('Authorization', `Bearer ${employeeUserToken}`)

      if (!listRes.body.data?.length) return
      const docId = listRes.body.data[0].id

      const res = await request(server)
        .get(`/api/v1/documents/${docId}`)
        .set('Authorization', `Bearer ${employeeUserToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(docId)
      expect(res.body.data.downloadUrl).toBeDefined()
      expect(res.body.data.downloadUrl).toContain('presigned-download-url')
    })

    it('returns 404 for cross-tenant document access', async () => {
      if (!isDbConnected) return

      const listRes = await request(server)
        .get('/api/v1/documents')
        .set('Authorization', `Bearer ${employeeUserToken}`)

      if (!listRes.body.data?.length) return
      const companyADocId = listRes.body.data[0].id

      // Company B employee tries to access Company A document
      const res = await request(server)
        .get(`/api/v1/documents/${companyADocId}`)
        .set('Authorization', `Bearer ${employeeBToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })
  })

  describe('DELETE /api/v1/documents/:id', () => {
    it('returns 404 for non-existent document', async () => {
      if (!isDbConnected) return

      const res = await request(server)
        .delete('/api/v1/documents/non-existent-id')
        .set('Authorization', `Bearer ${adminUserToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('returns 404 when attempting to delete a document from another company', async () => {
      if (!isDbConnected) return

      const listRes = await request(server)
        .get('/api/v1/documents')
        .set('Authorization', `Bearer ${employeeUserToken}`)

      if (!listRes.body.data?.length) return
      const companyADocId = listRes.body.data[0].id

      const res = await request(server)
        .delete(`/api/v1/documents/${companyADocId}`)
        .set('Authorization', `Bearer ${employeeBToken}`)

      expect(res.status).toBe(404)
    })

    it('allows the original uploader (EMPLOYEE) to delete their own document', async () => {
      if (!isDbConnected) return

      // Upload a document as employee
      const uploadRes = await request(server)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .attach('file', Buffer.from('To be deleted by uploader'), {
          filename: 'uploader_delete_test.txt',
          contentType: 'text/plain',
        })

      if (uploadRes.status !== 201) return
      const docId = uploadRes.body.data.id

      // Delete as the same employee
      const deleteRes = await request(server)
        .delete(`/api/v1/documents/${docId}`)
        .set('Authorization', `Bearer ${employeeUserToken}`)

      expect(deleteRes.status).toBe(200)
      expect(deleteRes.body.data.message).toBe('Document deleted successfully.')

      // Verify document is gone
      const checkRes = await request(server)
        .get(`/api/v1/documents/${docId}`)
        .set('Authorization', `Bearer ${employeeUserToken}`)
      expect(checkRes.status).toBe(404)
    })

    it('allows an ADMIN to delete any document within their company', async () => {
      if (!isDbConnected) return

      // Upload as employee
      const uploadRes = await request(server)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${employeeUserToken}`)
        .attach('file', Buffer.from('To be deleted by admin'), {
          filename: 'admin_delete_test.txt',
          contentType: 'text/plain',
        })

      if (uploadRes.status !== 201) return
      const docId = uploadRes.body.data.id

      // Delete as ADMIN
      const deleteRes = await request(server)
        .delete(`/api/v1/documents/${docId}`)
        .set('Authorization', `Bearer ${adminUserToken}`)

      expect(deleteRes.status).toBe(200)
      expect(deleteRes.body.data.message).toBe('Document deleted successfully.')
    })
  })
})
