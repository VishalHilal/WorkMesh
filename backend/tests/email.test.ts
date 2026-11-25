import { describe, it, expect, vi, beforeEach } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/db.js'
import { signAccessToken } from '../src/lib/auth.js'
import * as agentService from '../src/services/agent.service.js'

const server = http.createServer(app)

const COMPANY_A = 'comp_a_123'
const USER_A = 'user_a_123'
const TOKEN_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('Email Draft & Human-in-the-Loop Approval API (/api/v1/agents/email)', () => {
  const userToken = signAccessToken({
    userId: USER_A,
    companyId: COMPANY_A,
    role: 'EMPLOYEE',
  })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POST /draft generates draft via AI service and persists PENDING EmailDraft', async () => {
    const genSpy = vi.spyOn(agentService, 'generateEmailDraft').mockResolvedValue({
      approval_token: TOKEN_UUID,
      draft: {
        to: 'hr@workmesh.com',
        subject: 'Leave Request',
        body: 'Requesting leave for Friday.',
        cc: ['lead@workmesh.com'],
      },
    })

    const createSpy = vi.spyOn(prisma.emailDraft, 'create').mockResolvedValue({
      id: 'draft_1',
      companyId: COMPANY_A,
      userId: USER_A,
      approvalToken: TOKEN_UUID,
      to: 'hr@workmesh.com',
      subject: 'Leave Request',
      body: 'Requesting leave for Friday.',
      cc: ['lead@workmesh.com'],
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never)

    const res = await request(server)
      .post('/api/v1/agents/email/draft')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ instruction: 'Draft a leave email to HR' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.approval_token).toBe(TOKEN_UUID)
    expect(genSpy).toHaveBeenCalledWith({
      company_id: COMPANY_A,
      instruction: 'Draft a leave email to HR',
      context: undefined,
    })
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: COMPANY_A,
          userId: USER_A,
          approvalToken: TOKEN_UUID,
          status: 'PENDING',
        }),
      })
    )
  })

  it('POST /approve marks PENDING draft as APPROVED and returns confirmation', async () => {
    vi.spyOn(prisma.emailDraft, 'findFirst').mockResolvedValue({
      id: 'draft_1',
      companyId: COMPANY_A,
      userId: USER_A,
      approvalToken: TOKEN_UUID,
      to: 'hr@workmesh.com',
      subject: 'Leave Request',
      body: 'Body',
      cc: [],
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const updateSpy = vi
      .spyOn(prisma.emailDraft, 'updateMany')
      .mockResolvedValue({ count: 1 })
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never)

    const res = await request(server)
      .post('/api/v1/agents/email/approve')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ approval_token: TOKEN_UUID })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message).toBe('Email approved and queued for send')
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'draft_1', companyId: COMPANY_A, status: 'PENDING' },
      data: { status: 'APPROVED' },
    })
  })

  it('POST /approve returns 404 when token belongs to a different company', async () => {
    const findSpy = vi.spyOn(prisma.emailDraft, 'findFirst').mockResolvedValue(null)

    const res = await request(server)
      .post('/api/v1/agents/email/approve')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ approval_token: TOKEN_UUID })

    expect(res.status).toBe(404)
    expect(findSpy).toHaveBeenCalledWith({
      where: { approvalToken: TOKEN_UUID, companyId: COMPANY_A },
    })
  })

  it('POST /approve returns 409 if draft was already approved or rejected', async () => {
    vi.spyOn(prisma.emailDraft, 'findFirst').mockResolvedValue({
      id: 'draft_1',
      companyId: COMPANY_A,
      userId: USER_A,
      approvalToken: TOKEN_UUID,
      to: 'hr@workmesh.com',
      subject: 'Leave Request',
      body: 'Body',
      cc: [],
      status: 'APPROVED',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await request(server)
      .post('/api/v1/agents/email/approve')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ approval_token: TOKEN_UUID })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ALREADY_PROCESSED')
  })

  it('POST /reject marks PENDING draft as REJECTED', async () => {
    vi.spyOn(prisma.emailDraft, 'findFirst').mockResolvedValue({
      id: 'draft_2',
      companyId: COMPANY_A,
      userId: USER_A,
      approvalToken: TOKEN_UUID,
      to: 'hr@workmesh.com',
      subject: 'Leave Request',
      body: 'Body',
      cc: [],
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const updateSpy = vi
      .spyOn(prisma.emailDraft, 'updateMany')
      .mockResolvedValue({ count: 1 })
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as never)

    const res = await request(server)
      .post('/api/v1/agents/email/reject')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ approval_token: TOKEN_UUID })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'draft_2', companyId: COMPANY_A, status: 'PENDING' },
      data: { status: 'REJECTED' },
    })
  })

  it('POST /reject returns 401 without Authorization header', async () => {
    const res = await request(server)
      .post('/api/v1/agents/email/reject')
      .send({ approval_token: TOKEN_UUID })

    expect(res.status).toBe(401)
  })
})
