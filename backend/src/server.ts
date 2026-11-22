import { app } from './app.js'
import { env } from './config/env.js'

const server = app.listen(env.PORT, () => {
  console.log(`Backend server running on port ${env.PORT} [${env.NODE_ENV}]`)
})

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed gracefully.')
    process.exit(0)
  })
})

export { server }
