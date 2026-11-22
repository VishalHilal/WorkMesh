import { describe, it, expect } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'

const server = http.createServer(app)

describe('GET /api/v1/health', () => {
  it('returns a valid health response shape', async () => {
    const res = await request(server).get('/api/v1/health')

    // Status is 200 (DB connected) or 503 (DB not reachable in CI)
    expect([200, 503]).toContain(res.status)
    expect(['ok', 'degraded']).toContain(res.body.data.status)
    expect(res.body.data.services).toHaveProperty('database')
    expect(res.body.meta).toHaveProperty('timestamp')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await request(server).get('/api/v1/unknown')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
