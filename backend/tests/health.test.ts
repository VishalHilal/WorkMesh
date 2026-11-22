import { describe, it, expect } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'

const server = http.createServer(app)

describe('GET /api/v1/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(server).get('/api/v1/health')

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('ok')
    expect(res.body.meta).toHaveProperty('timestamp')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await request(server).get('/api/v1/unknown')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
