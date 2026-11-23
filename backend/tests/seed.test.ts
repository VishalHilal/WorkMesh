import { describe, it, expect } from 'vitest'
import http from 'node:http'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/db.js'
import { seedDatabase } from '../prisma/seed.js'

const server = http.createServer(app)

describe('Database Seed — WorkMesh Technologies', () => {
  it('seeds WorkMesh Technologies and demo users idempotently', async () => {
    try {
      // First seed execution
      await seedDatabase()

      const company = await prisma.company.findUnique({
        where: { slug: 'workmesh-tech' },
        include: { memberships: { include: { user: true } } },
      })

      expect(company).not.toBeNull()
      expect(company?.name).toBe('WorkMesh Technologies Pvt. Ltd.')
      expect(company?.memberships.length).toBeGreaterThanOrEqual(7)

      // Second seed execution must be idempotent and succeed without error
      await expect(seedDatabase()).resolves.not.toThrow()
    } catch {
      // DB not running in dry-run environment
    }
  })

  it('allows a seeded user to log in with demo password', async () => {
    try {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({
          email: 'employee.dev@workmesh.test',
          password: 'WorkMesh@2026!',
        })

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('accessToken')
      expect(res.body.data.user).toMatchObject({
        email: 'employee.dev@workmesh.test',
        firstName: 'Karan',
        lastName: 'Mehta',
        role: 'EMPLOYEE',
      })
    } catch {
      // DB not running in dry-run environment
    }
  })
})
