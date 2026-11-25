import { describe, it, expect, vi, beforeEach } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'
import { signAccessToken } from '../src/lib/auth.js'
import * as ragService from '../src/services/rag.service.js'
import * as agentService from '../src/services/agent.service.js'
import { prisma } from '../src/lib/db.js'

// In-memory mock store for conversation threads and messages
interface MockThread {
  id: string
  companyId: string
  userId: string
  title: string
  createdAt: Date
  updatedAt: Date
  messages: Array<{
    id: string
    threadId: string
    role: string
    content: string
    citations?: any
    createdAt: Date
  }>
}

let threadStore: MockThread[] = []

vi.mock('../src/lib/db.js', () => {
  return {
    prisma: {
      conversationThread: {
        findMany: vi.fn().mockImplementation(async ({ where }: { where: { companyId: string; userId: string } }) => {
          return threadStore
            .filter((t) => t.companyId === where.companyId && t.userId === where.userId)
            .map((t) => ({
              id: t.id,
              companyId: t.companyId,
              userId: t.userId,
              title: t.title,
              createdAt: t.createdAt,
              updatedAt: t.updatedAt,
              _count: { messages: t.messages.length },
            }))
        }),
        findFirst: vi.fn().mockImplementation(async ({ where }: { where: { id: string; companyId: string; userId: string } }) => {
          const match = threadStore.find(
            (t) => t.id === where.id && t.companyId === where.companyId && t.userId === where.userId
          )
          if (!match) return null
          return {
            ...match,
            messages: [...match.messages],
          }
        }),
        create: vi.fn().mockImplementation(async ({ data }: { data: { companyId: string; userId: string; title: string } }) => {
          const newThread: MockThread = {
            id: `thread_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            companyId: data.companyId,
            userId: data.userId,
            title: data.title,
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: [],
          }
          threadStore.push(newThread)
          return {
            ...newThread,
            _count: { messages: 0 },
          }
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: { title?: string; updatedAt?: Date } }) => {
          const t = threadStore.find((x) => x.id === where.id)
          if (t) {
            if (data.title) t.title = data.title
            if (data.updatedAt) t.updatedAt = data.updatedAt
          }
          return t
        }),
        delete: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          const idx = threadStore.findIndex((x) => x.id === where.id)
          if (idx >= 0) threadStore.splice(idx, 1)
          return { id: where.id }
        }),
      },
      threadMessage: {
        create: vi.fn().mockImplementation(async ({ data }: { data: any }) => {
          const msg = {
            id: `msg_${Date.now()}`,
            threadId: data.threadId,
            role: data.role,
            content: data.content,
            citations: data.citations ?? null,
            createdAt: new Date(),
          }
          const t = threadStore.find((x) => x.id === data.threadId)
          if (t) {
            t.messages.push(msg)
          }
          return msg
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit_test_1' }),
      },
      $transaction: vi.fn().mockImplementation(async (promises: Promise<any>[]) => {
        return Promise.all(promises)
      }),
    },
  }
})

const server = http.createServer(app)

describe('RAG Chat & Persistent Threads API', () => {
  const companyId = 'company_test_rag_123'
  const userId = 'user_employee_1'
  const validToken = signAccessToken({
    userId,
    companyId,
    role: 'EMPLOYEE',
  })

  const otherUserToken = signAccessToken({
    userId: 'other_user_456',
    companyId,
    role: 'EMPLOYEE',
  })

  beforeEach(() => {
    vi.clearAllMocks()
    threadStore = []
  })

  describe('Authentication & Authorization', () => {
    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(server)
        .post('/api/v1/rag/chat')
        .send({ query: 'What is our sick leave policy?' })

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })

    it('rejects malformed bearer token with 401 INVALID_TOKEN', async () => {
      const res = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', 'Bearer invalid.token.payload')
        .send({ query: 'Hello' })

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_TOKEN')
    })
  })

  describe('Conversation Thread Management (/api/v1/rag/threads)', () => {
    it('creates a new conversation thread with 201', async () => {
      const res = await request(server)
        .post('/api/v1/rag/threads')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Quarterly HR Guidelines' })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.title).toBe('Quarterly HR Guidelines')
      expect(res.body.data.userId).toBe(userId)
      expect(res.body.data.companyId).toBe(companyId)
    })

    it('lists only threads belonging to caller in caller company', async () => {
      // Create a thread for user 1
      await request(server)
        .post('/api/v1/rag/threads')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'User 1 Private Thread' })

      // Create a thread for user 2
      await request(server)
        .post('/api/v1/rag/threads')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ title: 'User 2 Private Thread' })

      // User 1 requests their threads
      const res = await request(server)
        .get('/api/v1/rag/threads')
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].title).toBe('User 1 Private Thread')
    })

    it('retrieves thread details and messages with GET /threads/:id', async () => {
      const createdRes = await request(server)
        .post('/api/v1/rag/threads')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Engineering Onboarding' })

      const threadId = createdRes.body.data.id

      const res = await request(server)
        .get(`/api/v1/rag/threads/${threadId}`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(threadId)
      expect(res.body.data.title).toBe('Engineering Onboarding')
      expect(Array.isArray(res.body.data.messages)).toBe(true)
    })

    it('prevents user from accessing another user thread (user-level isolation)', async () => {
      const createdRes = await request(server)
        .post('/api/v1/rag/threads')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Confidential Notes' })

      const threadId = createdRes.body.data.id

      // Other user tries to access
      const res = await request(server)
        .get(`/api/v1/rag/threads/${threadId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('renames a thread with PATCH /threads/:id', async () => {
      const createdRes = await request(server)
        .post('/api/v1/rag/threads')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Old Title' })

      const threadId = createdRes.body.data.id

      const res = await request(server)
        .patch(`/api/v1/rag/threads/${threadId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'New Renamed Title' })

      expect(res.status).toBe(200)
      expect(res.body.data.title).toBe('New Renamed Title')
    })

    it('deletes a thread with DELETE /threads/:id', async () => {
      const createdRes = await request(server)
        .post('/api/v1/rag/threads')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Temporary Thread' })

      const threadId = createdRes.body.data.id

      const delRes = await request(server)
        .delete(`/api/v1/rag/threads/${threadId}`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(delRes.status).toBe(200)
      expect(delRes.body.success).toBe(true)

      // Verify it no longer exists
      const getRes = await request(server)
        .get(`/api/v1/rag/threads/${threadId}`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(getRes.status).toBe(404)
    })
  })

  describe('RAG Chat Persistence & AI Proxying', () => {
    it('executes chat and persists user and assistant messages into specified thread', async () => {
      // 1. Create a thread
      const createdThread = await request(server)
        .post('/api/v1/rag/threads')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Company Leave Questions' })

      const threadId = createdThread.body.data.id

      // 2. Mock AI response
      const mockChatResponse: ragService.RagChatResponseData = {
        query: 'How many days of sick leave do we get?',
        answer: 'Employees receive 10 days of paid sick leave annually [Source: chunk-10].',
        citations: [
          {
            chunk_id: 'chunk-10',
            document_id: 'doc-leave-policy',
            chunk_index: 1,
            snippet: 'Employees receive 10 days of paid sick leave annually.',
            similarity_score: 0.94,
          },
        ],
        model: 'gemini-3.8-flash',
        grounded: true,
      }

      vi.spyOn(ragService, 'sendRagChat').mockResolvedValueOnce(mockChatResponse)

      // 3. Send chat query with thread_id
      const chatRes = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          query: 'How many days of sick leave do we get?',
          thread_id: threadId,
          mode: 'rag',
        })

      expect(chatRes.status).toBe(200)
      expect(chatRes.body.success).toBe(true)
      expect(chatRes.body.data.thread_id).toBe(threadId)
      expect(chatRes.body.data.answer).toContain('10 days of paid sick leave')

      // 4. Verify messages are persisted in thread
      const threadRes = await request(server)
        .get(`/api/v1/rag/threads/${threadId}`)
        .set('Authorization', `Bearer ${validToken}`)

      expect(threadRes.status).toBe(200)
      expect(threadRes.body.data.messages).toHaveLength(2)
      expect(threadRes.body.data.messages[0].role).toBe('user')
      expect(threadRes.body.data.messages[0].content).toBe('How many days of sick leave do we get?')
      expect(threadRes.body.data.messages[1].role).toBe('assistant')
      expect(threadRes.body.data.messages[1].citations).toHaveLength(1)
    })

    it('auto-creates a conversation thread when no thread_id is provided', async () => {
      const mockChatResponse: ragService.RagChatResponseData = {
        query: 'What is the standard working hours?',
        answer: 'Standard working hours are 9:00 AM to 6:00 PM Monday through Friday.',
        citations: [],
        model: 'gemini-3.8-flash',
        grounded: true,
      }

      vi.spyOn(ragService, 'sendRagChat').mockResolvedValueOnce(mockChatResponse)

      const chatRes = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          query: 'What is the standard working hours?',
          mode: 'rag',
        })

      expect(chatRes.status).toBe(200)
      expect(chatRes.body.success).toBe(true)
      expect(chatRes.body.data).toHaveProperty('thread_id')
      expect(typeof chatRes.body.data.thread_id).toBe('string')

      // Verify the auto-created thread exists in the list
      const listRes = await request(server)
        .get('/api/v1/rag/threads')
        .set('Authorization', `Bearer ${validToken}`)

      expect(listRes.status).toBe(200)
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1)
      expect(listRes.body.data[0].id).toBe(chatRes.body.data.thread_id)
    })
  })

  describe('Multi-Agent Supervisor Integration', () => {
    it('executes chat via supervisor in agent mode and records AGENT_WORKFLOW_EXECUTED audit event', async () => {
      const mockAgentResponse: agentService.AgentRunResponseData = {
        answer: 'Draft of announcement prepared [Subject: Team Meeting].',
        agent_handled: 'office_agent',
        agent_path: ['supervisor', 'office_agent'],
        citations: [],
        iterations: 1,
      }

      vi.spyOn(agentService, 'runSupervisorAgent').mockResolvedValueOnce(mockAgentResponse)

      const chatRes = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          query: 'Draft a quick announcement for the team meeting tomorrow.',
          mode: 'agent',
        })

      expect(chatRes.status).toBe(200)
      expect(chatRes.body.success).toBe(true)
      expect(chatRes.body.data.agentHandled).toBe('office_agent')
      expect(chatRes.body.data.agentPath).toEqual(['supervisor', 'office_agent'])
      expect(chatRes.body.data.mode).toBe('agent')
      expect(chatRes.body.data.answer).toContain('Draft of announcement')
      expect(chatRes.body.data).toHaveProperty('thread_id')

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'AGENT_WORKFLOW_EXECUTED',
            entityType: 'AgentChat',
            companyId,
          }),
        })
      )
    })

    it('returns 502/503 when AI agent service encounters error', async () => {
      vi.spyOn(agentService, 'runSupervisorAgent').mockRejectedValueOnce(
        new agentService.AgentServiceError('Agent graph failed', 503, 'AI_SERVICE_UNAVAILABLE')
      )

      const chatRes = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          query: 'Draft an announcement',
          mode: 'agent',
        })

      expect(chatRes.status).toBe(503)
      expect(chatRes.body.error.code).toBe('AI_SERVICE_UNAVAILABLE')
    })
  })
})
