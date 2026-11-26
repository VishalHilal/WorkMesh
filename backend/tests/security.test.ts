import { describe, it, expect } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'

const server = http.createServer(app)

describe('Production Security & Request Correlation Hardening', () => {
  it('generates and echoes X-Request-Id header when omitted', async () => {
    const res = await request(server).get('/')

    expect(res.status).toBe(200)
    const reqId = res.headers['x-request-id']
    expect(typeof reqId).toBe('string')
    expect(reqId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })

  it('preserves caller-supplied X-Request-Id header', async () => {
    const customId = 'trace-req-987654'
    const res = await request(server).get('/').set('X-Request-Id', customId)

    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).toBe(customId)
  })

  it('allows configured CORS origin and omits header for disallowed origin', async () => {
    const allowedRes = await request(server)
      .get('/')
      .set('Origin', 'http://localhost:3000')

    expect(allowedRes.headers['access-control-allow-origin']).toBe('http://localhost:3000')

    const blockedRes = await request(server)
      .get('/')
      .set('Origin', 'https://untrusted-origin.example')

    expect(blockedRes.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('rejects JSON payloads larger than 1mb with HTTP 413 and includes requestId in error meta', async () => {
    const oversizedPayload = { data: 'a'.repeat(1_200_000) }
    const customId = 'oversize-trace-111'

    const res = await request(server)
      .post('/api/v1/auth/login')
      .set('X-Request-Id', customId)
      .send(oversizedPayload)

    expect(res.status).toBe(413)
    expect(res.body.meta.requestId).toBe(customId)
  })
})
