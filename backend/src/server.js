import 'dotenv/config'
import app from './app.js'
import { connectDatabase } from './config/db.js'
import { validateEnvironment } from './config/env.js'

const { port } = validateEnvironment()
let server

try {
  console.log('Connecting to MongoDB...')
  await connectDatabase()
  server = await new Promise((resolve, reject) => {
    const instance = app.listen(port, () => resolve(instance))
    instance.once('error', reject)
  })
  console.log(`Backend is running on port ${port}`)
} catch (error) {
  if (error.code === 'EADDRINUSE') console.error(`Backend could not start: port ${port} is already in use. Stop the other process or set a different PORT in .env.`)
  else console.error(`VELTRIX API startup failed: ${error.message}`)
  process.exitCode = 1
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down VELTRIX API.`)
  if (server) await new Promise(resolve => server.close(resolve))
  const mongoose = await import('mongoose')
  await mongoose.default.disconnect()
  process.exit(0)
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
