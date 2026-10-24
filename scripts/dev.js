import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const apiUrl = `http://localhost:${process.env.PORT || 4000}/api/health`
const children = new Map()
let stopping = false

async function apiIsHealthy() {
  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(1500) })
    if (!response.ok) return false
    const health = await response.json()
    return health.status === 'ok' && health.database === 'connected'
  } catch {
    return false
  }
}

function stop(signal = 'Development process stopped') {
  if (stopping) return
  stopping = true
  console.log(`\n${signal}; stopping VELTRIX development servers.`)
  for (const child of children.values()) if (child.exitCode === null) child.kill()
}

function start(name, command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', ...options })
  children.set(name, child)
  child.once('error', error => {
    console.error(`${name} could not start: ${error.message}`)
    stop()
    process.exitCode = 1
  })
  child.once('exit', (code, signal) => {
    children.delete(name)
    if (!stopping && code !== 0) {
      console.error(`${name} stopped unexpectedly${signal ? ` (${signal})` : ` with exit code ${code}`}.`)
      stop()
      process.exitCode = code || 1
    }
  })
  return child
}

process.once('SIGINT', () => stop('Ctrl+C received'))
process.once('SIGTERM', () => stop('Termination signal received'))

if (await apiIsHealthy()) {
  console.log('Using the already running API at port', process.env.PORT || 4000)
} else {
  start('API', process.execPath, ['backend/src/server.js'])
  let healthy = false
  for (let attempt = 0; attempt < 30 && !stopping; attempt += 1) {
    if (await apiIsHealthy()) { healthy = true; break }
    if (![...children.values()].some(child => child.exitCode === null)) break
    await delay(500)
  }
  if (!healthy) {
    console.error('API did not become healthy. Check the MongoDB connection and backend startup messages above.')
    stop()
    process.exitCode = 1
  }
}

if (!stopping) {
  const vite = fileURLToPath(new URL('../frontend/node_modules/vite/bin/vite.js', import.meta.url))
  const frontendDirectory = fileURLToPath(new URL('../frontend/', import.meta.url))
  start('Frontend', process.execPath, [vite, '--configLoader', 'native', '--host', 'localhost'], { cwd: frontendDirectory })
  console.log('Open the frontend at the Local URL printed by Vite above (it may use port 5174 if 5173 is busy).')
}
