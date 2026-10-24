import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { uploadDirectory } from './middleware/upload.js'
import api from './routes/api.js'
import support from './routes/support.js'
import settings from './routes/settings.js'
import { errorHandler, notFound } from './middleware/errors.js'

const app = express()
const frontendOrigin = new URL(process.env.FRONTEND_ORIGIN || 'http://localhost:5173').origin
const isAllowedFrontendOrigin = origin => {
  if (!origin) return true
  try {
    const url = new URL(origin)
    if (url.origin === frontendOrigin) return true
    return process.env.NODE_ENV !== 'production'
      && url.protocol === 'http:'
      && ['localhost', '127.0.0.1'].includes(url.hostname)
      && Number(url.port) >= 5173 && Number(url.port) <= 5180
  } catch {
    return false
  }
}
app.disable('x-powered-by')
if (process.env.TRUST_PROXY && process.env.TRUST_PROXY !== 'false') app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : Number(process.env.TRUST_PROXY))
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: (origin, callback) => callback(null, isAllowedFrontendOrigin(origin)), credentials: true }))
app.use('/api', (req, res, next) => {
  const origin = req.get('origin')
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  if (origin && !safeMethods.includes(req.method) && !isAllowedFrontendOrigin(origin)) return res.status(403).json({ error: 'This request origin is not allowed.' })
  next()
})
app.use(express.json({ limit: '1mb' }))
app.use('/uploads', express.static(uploadDirectory, { index: false, dotfiles: 'deny', maxAge: '1d', immutable: true }))
app.use(cookieParser())
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/support', support)
app.use('/api/settings', settings)
app.use('/api', api)
app.use(notFound)
app.use(errorHandler)
export default app
