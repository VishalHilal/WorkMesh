import { describe, it, expect, vi, beforeEach } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/db.js'
import { signAccessToken } from '../src/lib/auth.js'
import * as storage from '../src/lib/storage.js'
import * as reportService from '../src/services/report.service.js'

const server = http.createServer(app)

const COMPANY_A = 'comp_report_a'
const USER_A = 'user_report_a'
const OTHER_USER_A = 'user_report_other_a'

describe('Report Storage & Download API (/api/v1/reports)', () => {
  const employeeToken = signAccessToken({
    userId: USER_A,
    companyId: COMPANY_A,
    role: 'EMPLOYEE',
  })

  const otherEmployeeToken = signAccessToken({
    userId: OTHER_USER_A,
    companyId: COMPANY_A,
    role: 'EMPLOYEE',
  })

  const adminToken = signAccessToken({
    userId: 'admin_report_a',
    companyId: COMPANY_A,
    role: 'ADMIN',
  })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POST /generate returns 401 without Authorization header', async () => {
    const res = await request(server)
      .post('/api/v1/reports/generate')
      .send({ title: 'Q4 Summary', prompt: 'Summarize Q4', format: 'pdf' })

    expect(res.status).toBe(401)
  })

  it('POST /generate returns 422 on invalid format', async () => {
    const res = await request(server)
      .post('/api/v1/reports/generate')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ title: 'Q4 Summary', prompt: 'Summarize Q4', format: 'xlsx' })

    expect(res.status).toBe(422)
  })

  it('POST /generate calls AI service, uploads to private S3, persists metadata, returns 201', async () => {
    const pdfBase64 = Buffer.from('%PDF-1.4 sample').toString('base64')

    vi.spyOn(reportService, 'generateAiReport').mockResolvedValue({
      title: 'Q4 Summary',
      format: 'pdf',
      template: 'executive_summary',
      file_name: 'q4-summary.pdf',
      mime_type: 'application/pdf',
      file_size: 15,
      content_base64: pdfBase64,
      citations: [],
    })

    const uploadSpy = vi.spyOn(storage, 'uploadObject').mockResolvedValue({} as never)
    const createSpy = vi.spyOn(prisma.generatedReport, 'create').mockResolvedValue({
      id: 'rep_1',
      companyId: COMPANY_A,
      userId: USER_A,
      title: 'Q4 Summary',
      format: 'PDF',
      template: 'executive_summary',
      fileName: 'q4-summary.pdf',
      mimeType: 'application/pdf',
      fileSize: 15,
      storageKey: `reports/${COMPANY_A}/q4-summary.pdf`,
      createdAt: new Date(),
    })
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never)

    const res = await request(server)
      .post('/api/v1/reports/generate')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ title: 'Q4 Summary', prompt: 'Summarize Q4', format: 'pdf' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBe('rep_1')
    expect(uploadSpy).toHaveBeenCalledTimes(1)
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: COMPANY_A,
          userId: USER_A,
          format: 'PDF',
        }),
      })
    )
  })

  it('GET / lists reports strictly scoped to caller companyId', async () => {
    const countSpy = vi.spyOn(prisma.generatedReport, 'count').mockResolvedValue(1)
    const findSpy = vi.spyOn(prisma.generatedReport, 'findMany').mockResolvedValue([
      {
        id: 'rep_1',
        companyId: COMPANY_A,
        userId: USER_A,
        title: 'Q4 Summary',
        format: 'PDF',
        template: 'executive_summary',
        fileName: 'q4-summary.pdf',
        mimeType: 'application/pdf',
        fileSize: 15,
        storageKey: `reports/${COMPANY_A}/q4-summary.pdf`,
        createdAt: new Date(),
      },
    ])

    const res = await request(server)
      .get('/api/v1/reports?page=1&limit=10')
      .set('Authorization', `Bearer ${employeeToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(countSpy).toHaveBeenCalledWith({ where: { companyId: COMPANY_A } })
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_A } })
    )
  })

  it('GET /:id/download returns presigned URL for same company and 404 for cross-tenant', async () => {
    vi.spyOn(prisma.generatedReport, 'findFirst').mockResolvedValueOnce({
      id: 'rep_1',
      companyId: COMPANY_A,
      userId: USER_A,
      title: 'Q4 Summary',
      format: 'PDF',
      template: 'executive_summary',
      fileName: 'q4-summary.pdf',
      mimeType: 'application/pdf',
      fileSize: 15,
      storageKey: `reports/${COMPANY_A}/q4-summary.pdf`,
      createdAt: new Date(),
    })
    vi.spyOn(storage, 'getPresignedDownloadUrl').mockResolvedValue('https://signed.example/q4.pdf')
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never)

    const okRes = await request(server)
      .get('/api/v1/reports/rep_1/download')
      .set('Authorization', `Bearer ${employeeToken}`)

    expect(okRes.status).toBe(200)
    expect(okRes.body.data.downloadUrl).toBe('https://signed.example/q4.pdf')
    expect(okRes.body.data.expiresInSeconds).toBe(300)

    // Cross-tenant / missing report
    vi.spyOn(prisma.generatedReport, 'findFirst').mockResolvedValueOnce(null)
    const notFoundRes = await request(server)
      .get('/api/v1/reports/other_co_rep/download')
      .set('Authorization', `Bearer ${employeeToken}`)

    expect(notFoundRes.status).toBe(404)
  })

  it('DELETE /:id enforces creator-or-admin authorization', async () => {
    const reportRow = {
      id: 'rep_1',
      companyId: COMPANY_A,
      userId: USER_A,
      title: 'Q4 Summary',
      format: 'PDF' as const,
      template: 'executive_summary',
      fileName: 'q4-summary.pdf',
      mimeType: 'application/pdf',
      fileSize: 15,
      storageKey: `reports/${COMPANY_A}/q4-summary.pdf`,
      createdAt: new Date(),
    }

    vi.spyOn(prisma.generatedReport, 'findFirst').mockResolvedValue(reportRow)

    // Unrelated employee -> 403
    const forbiddenRes = await request(server)
      .delete('/api/v1/reports/rep_1')
      .set('Authorization', `Bearer ${otherEmployeeToken}`)

    expect(forbiddenRes.status).toBe(403)

    // Admin -> 200
    vi.spyOn(storage, 'deleteObject').mockResolvedValue({} as never)
    vi.spyOn(prisma.generatedReport, 'delete').mockResolvedValue(reportRow)
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never)

    const adminRes = await request(server)
      .delete('/api/v1/reports/rep_1')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(adminRes.status).toBe(200)
    expect(adminRes.body.success).toBe(true)
  })
})
