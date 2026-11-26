import { app } from './app.js'
import { env } from './config/env.js'
import { prisma } from './lib/db.js'

const server = app.listen(env.PORT, () => {
  console.log(`Backend server running on port ${env.PORT} [${env.NODE_ENV}]`)
})

function shutdown(signal: string): void {
  console.log(`Received ${signal}. Closing HTTP server and database connections...`)
  const forceTimer = setTimeout(() => {
    console.error('Forced shutdown after 10s timeout.')
    process.exit(1)
  }, 10_000)
  forceTimer.unref()

  server.close(async () => {
    try {
      await prisma.$disconnect()
      console.log('Server and Prisma disconnected gracefully.')
      process.exit(0)
    } catch (err) {
      console.error('Error disconnecting Prisma during shutdown:', err)
      process.exit(1)
    }
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export { server }
