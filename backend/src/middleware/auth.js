import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.accessToken || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Sign in to continue.' })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.sub).select('_id name email role status avatar phone address createdAt emailVerified passwordChangedAt')
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'This account is unavailable. Contact an administrator.' })
    if ((payload.pwd || 0) !== (user.passwordChangedAt?.getTime() || 0)) return res.status(401).json({ error: 'Your session expired after a password change. Sign in again.' })
    if (!user.emailVerified) return res.status(403).json({ error: 'Verify your email before using your account.' })
    req.user = user
    next()
  } catch { res.status(401).json({ error: 'Your session has expired. Sign in again.' }) }
}
export const allowRoles = (...roles) => (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'You do not have permission to perform this action.' })
