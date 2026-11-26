import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env.js'
import { healthRouter } from './routes/health.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { usersRouter } from './routes/user.routes.js'
import { documentsRouter } from './routes/document.routes.js'
import { ragRouter } from './routes/rag.routes.js'
import { auditRouter } from './routes/audit.routes.js'
import { emailRouter } from './routes/email.routes.js'
import { reportRouter } from './routes/report.routes.js'
import { requestIdMiddleware } from './middleware/requestId.middleware.js'
import { errorMiddleware } from './middleware/error.middleware.js'

const app = express()

// Trust reverse proxy (e.g., Render, Vercel, Cloudflare) for rate limiting & accurate client IP
app.set('trust proxy', 1)

const allowedOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(requestIdMiddleware)
app.use(helmet())
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
  })
)
app.use(express.json({ limit: '1mb' }))

// Routes
app.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'WorkMesh API Server is running.',
    version: '1.0.0',
    endpoints: {
      health: '/api/v1/health',
      auth: '/api/v1/auth',
      documents: '/api/v1/documents',
      users: '/api/v1/users',
      rag: '/api/v1/rag',
    },
    meta: { timestamp: new Date().toISOString() },
  })
})

app.use('/api/v1/health', healthRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/users', usersRouter)
app.use('/api/v1/documents', documentsRouter)
app.use('/api/v1/rag', ragRouter)
app.use('/api/v1/audit-logs', auditRouter)
app.use('/api/v1/agents/email', emailRouter)
app.use('/api/v1/reports', reportRouter)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
    meta: { timestamp: new Date().toISOString() },
  })
})

// Error handler — must be last
app.use(errorMiddleware)

export { app }
