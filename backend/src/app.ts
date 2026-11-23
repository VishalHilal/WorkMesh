import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { healthRouter } from './routes/health.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { usersRouter } from './routes/user.routes.js'
import { errorMiddleware } from './middleware/error.middleware.js'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/v1/health', healthRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/users', usersRouter)

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
