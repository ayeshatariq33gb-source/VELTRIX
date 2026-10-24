import { Readable } from 'node:stream'

export const config = { api: { bodyParser: false } }

const blockedRequestHeaders = new Set(['connection', 'content-length', 'host', 'keep-alive', 'transfer-encoding', 'upgrade', 'accept-encoding'])
const blockedResponseHeaders = new Set(['connection', 'content-length', 'content-encoding', 'keep-alive', 'transfer-encoding', 'upgrade'])

export default async function handler(req, res) {
  const configuredBackend = process.env.BACKEND_URL
  if (!configuredBackend) return res.status(503).json({ error: 'The API proxy is missing its BACKEND_URL configuration.' })

  let backend
  try {
    backend = new URL(configuredBackend)
    if (backend.protocol !== 'https:' && backend.hostname !== 'localhost') throw new Error('BACKEND_URL must use HTTPS.')
  } catch (error) {
    return res.status(500).json({ error: error.message || 'BACKEND_URL is invalid.' })
  }

  let target
  try {
    target = new URL(req.url || '/api/health', backend)
    if (target.origin !== backend.origin || !target.pathname.startsWith('/api/')) throw new Error('Invalid API path.')
  } catch {
    return res.status(400).json({ error: 'Invalid API proxy request.' })
  }

  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined && !blockedRequestHeaders.has(name.toLowerCase())) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
  }

  try {
    const hasBody = !['GET', 'HEAD'].includes(req.method || 'GET')
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      ...(hasBody ? { body: req, duplex: 'half' } : {}),
      redirect: 'manual',
    })

    res.status(upstream.status)
    upstream.headers.forEach((value, name) => {
      if (!blockedResponseHeaders.has(name.toLowerCase()) && name.toLowerCase() !== 'set-cookie') res.setHeader(name, value)
    })
    const cookies = upstream.headers.getSetCookie?.() || []
    if (cookies.length) res.setHeader('set-cookie', cookies)
    if (!upstream.body) return res.end()
    Readable.fromWeb(upstream.body).pipe(res)
  } catch {
    if (!res.headersSent) res.status(502).json({ error: 'The VELTRIX API is temporarily unavailable. Please retry.' })
    else res.end()
  }
}
