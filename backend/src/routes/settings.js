import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import ApplicationSetting from '../models/ApplicationSetting.js'
import AuditLog from '../models/AuditLog.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { asyncRoute } from '../utils/asyncRoute.js'

const router = Router()
router.use(authenticate, allowRoles('admin'))
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg, fields: errors.array() })
  next()
}

router.get('/', asyncRoute(async (_req, res) => {
  const setting = await ApplicationSetting.findOne({ key: 'workspace' }).lean()
  res.json({ settings: setting?.value || { name: 'VELTRIX', lowStockNotifications: true, orderNotifications: true } })
}))

router.patch('/', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('lowStockNotifications').optional().isBoolean().toBoolean(),
  body('orderNotifications').optional().isBoolean().toBoolean(),
], validate, asyncRoute(async (req, res) => {
  const allowed = ['name', 'lowStockNotifications', 'orderNotifications']
  const patch = Object.fromEntries(allowed.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]))
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Provide at least one supported setting.' })
  const setting = await ApplicationSetting.findOneAndUpdate(
    { key: 'workspace' },
    { $set: { ...Object.fromEntries(Object.entries(patch).map(([key, value]) => [`value.${key}`, value])), updatedBy: req.user._id }, $setOnInsert: { key: 'workspace' } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  )
  await AuditLog.create({ actor: req.user._id, action: 'settings.update', entity: 'ApplicationSetting', entityId: String(setting._id), details: { fields: Object.keys(patch) }, ip: req.ip })
  res.json({ settings: setting.value })
}))

export default router
