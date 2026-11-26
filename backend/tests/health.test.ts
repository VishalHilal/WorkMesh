import { describe, it, expect, vi, beforeEach } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/db.js'

const server = http.createServer(app)

describe('GET /api/v1/health', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 200 and running status for root /', async () => {
    const res = await request(server).get('/')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.message).toBe('WorkMesh API Server is running.')
  })

  it('returns a valid health response shape', async () => {
    const res = await request(server).get('/api/v1/health')

    // Status is 200 (DB connected) or 503 (DB not reachable in CI)
    expect([200, 503]).toContain(res.status)
    expect(['ok', 'degraded']).toContain(res.body.data.status)
    expect(res.body.data.services).toHaveProperty('database')
    expect(res.body.meta).toHaveProperty('timestamp')
  })

  it('GET /api/v1/health/ready returns 200 when database and AI service are healthy', async () => {
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([1] as never)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
    )

    const res = await request(server).get('/api/v1/health/ready')

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('ok')
    expect(res.body.data.services).toEqual({ database: 'ok', aiService: 'ok' })
  })

  it('GET /api/v1/health/ready returns 503 when AI service is unreachable', async () => {
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([1] as never)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    )

    const res = await request(server).get('/api/v1/health/ready')

    expect(res.status).toBe(503)
    expect(res.body.data.status).toBe('degraded')
    expect(res.body.data.services).toEqual({ database: 'ok', aiService: 'error' })
  })

  it('returns 404 for unknown routes', async () => {
    const res = await request(server).get('/api/v1/unknown')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
