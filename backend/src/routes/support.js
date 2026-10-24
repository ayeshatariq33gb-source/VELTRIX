import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import SupportRequest from '../models/SupportRequest.js'
import Order from '../models/Order.js'
import Notification from '../models/Notification.js'
import AuditLog from '../models/AuditLog.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { asyncRoute } from '../utils/asyncRoute.js'

const router = Router()
const admin = [authenticate, allowRoles('admin')]
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg, fields: errors.array() })
  next()
}

router.use(authenticate)

router.post('/', [body('subject').trim().isLength({ min: 3, max: 160 }), body('message').trim().isLength({ min: 10, max: 5000 }), body('category').optional().isIn(['account', 'order', 'inventory', 'other']), body('orderId').optional({ checkFalsy: true }).isMongoId()], validate, asyncRoute(async (req, res) => {
  let order
  if (req.body.orderId) {
    order = await Order.findOne({ _id: req.body.orderId, ...(req.user.role === 'admin' ? {} : { user: req.user._id }) }).select('_id')
    if (!order) return res.status(404).json({ error: 'Order not found.' })
  }
  const request = await SupportRequest.create({ user: req.user._id, subject: req.body.subject, message: req.body.message, category: req.body.category || 'other', ...(order ? { order: order._id } : {}), history: [{ status: 'open', actor: req.user._id }] })
  await Promise.allSettled([
    Notification.create({ role: 'admin', title: 'New support request', body: `${req.user.name}: ${request.subject}`, kind: 'support' }),
    AuditLog.create({ actor: req.user._id, action: 'support.create', entity: 'SupportRequest', entityId: String(request._id), ip: req.ip }),
  ])
  res.status(201).json({ request })
}))

router.get('/', asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25))
  const filter = req.user.role === 'admin' ? {} : { user: req.user._id }
  if (req.user.role === 'admin' && ['open', 'in_progress', 'resolved', 'closed'].includes(req.query.status)) filter.status = req.query.status
  const [requests, total] = await Promise.all([
    SupportRequest.find(filter).populate('user', 'name email').populate('order', 'number total status').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SupportRequest.countDocuments(filter),
  ])
  res.json({ requests, page, limit, total, pages: Math.ceil(total / limit) })
}))

router.patch('/:id', ...admin, [body('status').isIn(['open', 'in_progress', 'resolved', 'closed']), body('adminNote').optional().isString().isLength({ max: 2000 })], validate, asyncRoute(async (req, res) => {
  const request = await SupportRequest.findById(req.params.id)
  if (!request) return res.status(404).json({ error: 'Support request not found.' })
  const previousStatus = request.status
  request.status = req.body.status
  if (req.body.adminNote !== undefined) request.adminNote = req.body.adminNote.trim()
  request.history.push({ status: request.status, note: request.adminNote, actor: req.user._id, at: new Date() })
  await request.save()
  await Promise.allSettled([
    Notification.create({ user: request.user, role: 'user', title: 'Support request updated', body: `Your request “${request.subject}” is ${request.status.replace('_', ' ')}.`, kind: 'support' }),
    AuditLog.create({ actor: req.user._id, action: 'support.update', entity: 'SupportRequest', entityId: String(request._id), details: { from: previousStatus, to: request.status }, ip: req.ip }),
  ])
  res.json({ request })
}))

export default router
