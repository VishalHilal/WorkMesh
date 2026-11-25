import { describe, it, expect, vi, beforeEach } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'
import { signAccessToken } from '../src/lib/auth.js'
import * as ragService from '../src/services/rag.service.js'

const server = http.createServer(app)

describe('RAG Chat API (/api/v1/rag/chat)', () => {
  const companyId = 'company_test_rag_123'
  const validToken = signAccessToken({
    userId: 'user_employee_1',
    companyId,
    role: 'EMPLOYEE',
  })

  beforeEach(() => {
    vi.restoreAllMocks()
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

  describe('Payload Validation', () => {
    it('rejects empty query string with 400 VALIDATION_ERROR', async () => {
      const res = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ query: '   ' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(res.body.error.details).toHaveProperty('query')
    })

    it('rejects missing query with 400 VALIDATION_ERROR', async () => {
      const res = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ top_k: 5 })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('rejects top_k exceeding 20 with 400 VALIDATION_ERROR', async () => {
      const res = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ query: 'test', top_k: 50 })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(res.body.error.details).toHaveProperty('top_k')
    })

    it('rejects threshold greater than 1 with 400 VALIDATION_ERROR', async () => {
      const res = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ query: 'test', threshold: 1.5 })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(res.body.error.details).toHaveProperty('threshold')
    })
  })

  describe('Tenant Scoping & AI Proxying', () => {
    it('enforces tenant scoping and returns successful answer with citations', async () => {
      const mockChatResponse: ragService.RagChatResponseData = {
        query: 'What is the vacation policy?',
        answer: 'Employees receive 20 days paid vacation [Source: chunk-1].',
        citations: [
          {
            chunk_id: 'chunk-1',
            document_id: 'doc-handbook',
            chunk_index: 0,
            snippet: 'Employees receive 20 days paid vacation annually.',
            similarity_score: 0.92,
          },
        ],
        model: 'gemini-3.8-flash',
        grounded: true,
      }

      const sendRagChatSpy = vi
        .spyOn(ragService, 'sendRagChat')
        .mockResolvedValueOnce(mockChatResponse)

      const res = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          query: 'What is the vacation policy?',
          top_k: 3,
          threshold: 0.5,
          chat_history: [{ role: 'user', content: 'Hi' }],
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.query).toBe('What is the vacation policy?')
      expect(res.body.data.answer).toContain('20 days paid vacation')
      expect(res.body.data.citations).toHaveLength(1)
      expect(res.body.data.citations[0].chunk_id).toBe('chunk-1')
      expect(res.body.data.model).toBe('gemini-3.8-flash')
      expect(res.body.data.grounded).toBe(true)

      // Strict tenant isolation verification: companyId passed to AI service must match authenticated user
      expect(sendRagChatSpy).toHaveBeenCalledWith({
        company_id: companyId,
        query: 'What is the vacation policy?',
        top_k: 3,
        threshold: 0.5,
        chat_history: [{ role: 'user', content: 'Hi' }],
        document_ids: undefined,
      })
    })

    it('handles AI service failure and returns appropriate error code and status', async () => {
      vi.spyOn(ragService, 'sendRagChat').mockRejectedValueOnce(
        new ragService.RagServiceError('AI service is temporarily unavailable', 503, 'AI_SERVICE_UNAVAILABLE'),
      )

      const res = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ query: 'What are the security rules?' })

      expect(res.status).toBe(503)
      expect(res.body.error.code).toBe('AI_SERVICE_UNAVAILABLE')
      expect(res.body.error.message).toContain('AI service is temporarily unavailable')
    })

    it('handles AI service timeout with 504 AI_TIMEOUT', async () => {
      vi.spyOn(ragService, 'sendRagChat').mockRejectedValueOnce(
        new ragService.RagServiceError('AI service request timed out after 30 seconds.', 504, 'AI_TIMEOUT'),
      )

      const res = await request(server)
        .post('/api/v1/rag/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ query: 'Complex query' })

      expect(res.status).toBe(504)
      expect(res.body.error.code).toBe('AI_TIMEOUT')
    })
  })
})
