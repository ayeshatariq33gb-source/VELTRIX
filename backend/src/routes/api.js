import { Router } from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import User from '../models/User.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import StockMovement from '../models/StockMovement.js'
import Notification from '../models/Notification.js'
import AuditLog from '../models/AuditLog.js'
import Supplier from '../models/Supplier.js'
import Warehouse from '../models/Warehouse.js'
import CatalogEntry from '../models/CatalogEntry.js'
import PurchaseOrder from '../models/PurchaseOrder.js'
import ApplicationSetting from '../models/ApplicationSetting.js'
import FailedPaymentAttempt from '../models/FailedPaymentAttempt.js'
import { isEmailConfigured, sendResetEmail, sendVerificationEmail } from '../services/email.js'
import { csvUpload, imageUpload, uploadDirectory } from '../middleware/upload.js'
import { authenticate, allowRoles } from '../middleware/auth.js'
import { asyncRoute } from '../utils/asyncRoute.js'

const router = Router()
const admin = [authenticate, allowRoles('admin')]
const tokenFor = user => jwt.sign({ sub: user.id, pwd: user.passwordChangedAt?.getTime() || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' })
const safeUser = user => ({ id: user.id || String(user._id), name: user.name, email: user.email, role: user.role, status: user.status, avatar: user.avatar, phone: user.phone || '', address: user.address || {}, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt })
const cookieOpts = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000, path: '/api' })
const validate = (req, res, next) => { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg, fields: errors.array() }); next() }
const audit = (req, action, entity, entityId, details = {}) => AuditLog.create({ actor: req.user?._id, action, entity, entityId: String(entityId || ''), details, ip: req.ip }).catch(error => { console.error('Audit log write failed:', error.message); return null })
const notify = async data => {
  try {
    if (['inventory', 'order'].includes(data.kind)) {
      const setting = await ApplicationSetting.findOne({ key: 'workspace' }).select('value').lean()
      if (data.kind === 'inventory' && setting?.value?.lowStockNotifications === false) return null
      if (data.kind === 'order' && setting?.value?.orderNotifications === false) return null
    }
    return await Notification.create(data)
  } catch (error) {
    console.error('Notification write failed:', error.message)
    return null
  }
}
const publicFileUrl = filename => `${(process.env.BACKEND_ORIGIN || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '')}/uploads/${filename}`
async function verifiedImage(file) { const bytes = await fs.readFile(file.path); const type = bytes.subarray(0, 12); const valid = (file.mimetype === 'image/jpeg' && type[0] === 0xff && type[1] === 0xd8 && type[2] === 0xff) || (file.mimetype === 'image/png' && type.subarray(0,8).toString('hex') === '89504e470d0a1a0a') || (file.mimetype === 'image/gif' && ['GIF87a','GIF89a'].includes(type.subarray(0,6).toString())) || (file.mimetype === 'image/webp' && type.subarray(0,4).toString() === 'RIFF' && type.subarray(8,12).toString() === 'WEBP'); if (!valid) { await fs.unlink(file.path); return false } return true }

router.post('/auth/register', [body('name').trim().isLength({ min: 2, max: 100 }), body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 8, max: 128 }).custom(value => Buffer.byteLength(value, 'utf8') <= 72).withMessage('Password must not exceed 72 UTF-8 bytes.')], validate, asyncRoute(async (req, res) => {
  const exists = await User.exists({ email: req.body.email })
  if (exists) return res.status(409).json({ error: 'An account with this email already exists.' })
  const verificationRequired = isEmailConfigured(), verificationToken = verificationRequired ? crypto.randomBytes(32).toString('hex') : undefined
  const user = await User.create({ name: req.body.name, email: req.body.email, password: req.body.password, emailVerified: !verificationRequired, ...(verificationToken ? { verificationTokenHash: crypto.createHash('sha256').update(verificationToken).digest('hex'), verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000 } : {}) })
  if (verificationRequired) {
    try { await sendVerificationEmail(user.email, verificationToken) }
    catch (error) { await User.deleteOne({ _id: user._id }); console.error('Verification email delivery failed:', error.message); return res.status(503).json({ error: 'Email delivery is temporarily unavailable. Please try again.' }) }
  }
  const adminUser = await User.findOne({ role: 'admin', status: 'active' }).select('_id')
  await notify({ user: adminUser?._id, role: 'admin', title: 'New registration', body: `${user.name} created an account.`, kind: 'user' })
  if (verificationRequired) return res.status(201).json({ verificationRequired: true, message: 'Check your email for a verification link.' })
  res.cookie('accessToken', tokenFor(user), cookieOpts()).status(201).json({ user: safeUser(user) })
}))
router.post('/auth/verify-email', [body('token').isString().isLength({ min: 32, max: 128 })], validate, asyncRoute(async (req, res) => { const hash = crypto.createHash('sha256').update(req.body.token).digest('hex'); const user = await User.findOne({ verificationTokenHash: hash, verificationTokenExpires: { $gt: Date.now() } }); if (!user) return res.status(400).json({ error: 'Verification link is invalid or expired.' }); user.emailVerified = true; user.verificationTokenHash = undefined; user.verificationTokenExpires = undefined; await user.save(); res.json({ ok: true }) }))
router.post('/auth/resend-verification', [body('email').isEmail().normalizeEmail()], validate, asyncRoute(async (req, res) => { const user = await User.findOne({ email: req.body.email }); if (user && !user.emailVerified && isEmailConfigured()) { const token = crypto.randomBytes(32).toString('hex'); user.verificationTokenHash = crypto.createHash('sha256').update(token).digest('hex'); user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; await user.save(); try { await sendVerificationEmail(user.email, token) } catch (error) { console.error('Verification email delivery failed:', error.message) } } res.json({ message: 'If verification is needed and email delivery is configured, a link will be sent.' }) }))
router.post('/auth/login', [body('email').isEmail().normalizeEmail(), body('password').isString().isLength({ min: 1, max: 128 })], validate, asyncRoute(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password')
  if (!user || !(await user.checkPassword(req.body.password))) return res.status(401).json({ error: 'Email or password is incorrect.' })
  if (user.status !== 'active') return res.status(403).json({ error: 'This account is disabled. Contact an administrator.' })
  if (!user.emailVerified) return res.status(403).json({ error: 'Verify your email before signing in.' })
  user.lastLoginAt = new Date(); await user.save()
  res.cookie('accessToken', tokenFor(user), cookieOpts()).json({ user: safeUser(user) })
}))
router.post('/auth/logout', (_req, res) => res.clearCookie('accessToken', { ...cookieOpts(), maxAge: undefined }).json({ ok: true }))
router.get('/auth/me', authenticate, (req, res) => res.json({ user: safeUser(req.user) }))
router.patch('/auth/profile', authenticate, [body('name').optional().trim().isLength({ min: 2, max: 100 }), body('avatar').optional().isString().isLength({ max: 500 }), body('phone').optional().isString().isLength({ max: 30 }), body('address').optional().isObject({ strict: true })], validate, asyncRoute(async (req, res) => {
  const address = req.body.address
  const addressLimits = { line1: 200, city: 100, region: 100, postalCode: 20, country: 100 }
  if (address && Object.entries(address).some(([key, value]) => !(key in addressLimits) || typeof value !== 'string' || value.length > addressLimits[key])) return res.status(400).json({ error: 'Address contains an unsupported or overlong field.' })
  const user = await User.findByIdAndUpdate(req.user.id, { $set: { ...(req.body.name ? { name: req.body.name } : {}), ...(req.body.avatar !== undefined ? { avatar: req.body.avatar } : {}), ...(req.body.phone !== undefined ? { phone: req.body.phone } : {}), ...(address ? { address } : {}) } }, { new: true, runValidators: true })
  res.json({ user: safeUser(user) })
}))
router.post('/uploads/profile-image', authenticate, imageUpload.single('image'), asyncRoute(async (req, res) => { if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' }); if (!await verifiedImage(req.file)) return res.status(400).json({ error: 'The uploaded file is not a valid supported image.' }); const user = await User.findByIdAndUpdate(req.user.id, { avatar: publicFileUrl(req.file.filename) }, { new: true }); res.json({ user: safeUser(user), url: user.avatar }) }))
router.post('/uploads/product-image', ...admin, imageUpload.single('image'), asyncRoute(async (req, res) => { if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' }); if (!await verifiedImage(req.file)) return res.status(400).json({ error: 'The uploaded file is not a valid supported image.' }); res.status(201).json({ url: publicFileUrl(req.file.filename) }) }))
router.patch('/auth/password', authenticate, [body('currentPassword').isString(), body('newPassword').isLength({ min: 8, max: 128 }).custom(value => Buffer.byteLength(value, 'utf8') <= 72).withMessage('Password must not exceed 72 UTF-8 bytes.')], validate, asyncRoute(async (req, res) => {
  const user = await User.findById(req.user.id).select('+password')
  if (!(await user.checkPassword(req.body.currentPassword))) return res.status(400).json({ error: 'Current password is incorrect.' })
  user.password = req.body.newPassword; user.passwordChangedAt = new Date(); await user.save(); res.cookie('accessToken', tokenFor(user), cookieOpts()).json({ ok: true })
}))
router.post('/auth/forgot-password', [body('email').isEmail().normalizeEmail()], validate, asyncRoute(async (_req, res) => {
  const user = await User.findOne({ email: _req.body.email })
  if (user && isEmailConfigured()) {
    const token = crypto.randomBytes(32).toString('hex')
    user.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex'); user.resetTokenExpires = Date.now() + 30 * 60 * 1000
    await user.save()
    try { await sendResetEmail(user.email, token) }
    catch (error) { user.resetTokenHash = undefined; user.resetTokenExpires = undefined; await user.save(); console.error('Password reset email delivery failed:', error.message) }
  }
  res.json({ message: 'If the account exists and email delivery is configured, a reset link will be sent.' })
}))
router.post('/auth/reset-password', [body('token').isString().isLength({ min: 32, max: 128 }), body('password').isLength({ min: 8, max: 128 }).custom(value => Buffer.byteLength(value, 'utf8') <= 72).withMessage('Password must not exceed 72 UTF-8 bytes.')], validate, asyncRoute(async (req, res) => {
  const hash = crypto.createHash('sha256').update(req.body.token).digest('hex')
  const user = await User.findOne({ resetTokenHash: hash, resetTokenExpires: { $gt: Date.now() } }).select('+password')
  if (!user) return res.status(400).json({ error: 'Reset link is invalid or expired.' })
  user.password = req.body.password; user.passwordChangedAt = new Date(); user.resetTokenHash = undefined; user.resetTokenExpires = undefined; await user.save(); res.json({ ok: true })
}))

router.get('/products', authenticate, asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 100))
  const sortFields = new Set(['name', 'sku', 'category', 'brand', 'price', 'cost', 'stock', 'createdAt', 'updatedAt'])
  const sortBy = sortFields.has(req.query.sort) ? req.query.sort : 'name'
  const filter = { status: 'active' }
  if (req.query.q) filter.$text = { $search: String(req.query.q).slice(0, 100) }
  if (req.query.category && req.query.category !== 'All categories') filter.category = req.query.category
  if (req.query.lowStock === 'true') filter.$expr = { $lte: ['$stock', '$min'] }
  const [products, total] = await Promise.all([Product.find(filter).sort({ [sortBy]: 1 }).skip((page - 1) * limit).limit(limit).lean(), Product.countDocuments(filter)])
  res.json({ products: products.map(p => ({ ...p, id: p._id })), page, limit, total, pages: Math.ceil(total / limit) })
}))
router.post('/products', ...admin, [body('name').trim().isLength({ min: 1, max: 160 }), body('sku').trim().isLength({ min: 1, max: 80 }), body('category').trim().notEmpty(), body('price').isFloat({ min: 0 }), body('cost').isFloat({ min: 0 }), body('stock').optional().isInt({ min: 0 }), body('min').optional().isInt({ min: 0 })], validate, asyncRoute(async (req, res) => {
  const product = await Product.create(pickProduct(req.body))
  try {
    if (product.stock) await StockMovement.create({ product: product._id, type: 'stock-in', quantity: product.stock, before: 0, after: product.stock, note: 'Opening balance', actor: req.user._id })
  } catch (error) {
    await Promise.allSettled([Product.deleteOne({ _id: product._id }), StockMovement.deleteMany({ product: product._id, note: 'Opening balance' })])
    throw error
  }
  await audit(req, 'product.create', 'Product', product._id); res.status(201).json({ product: { ...product.toObject(), id: product.id } })
}))
router.post('/products/import', ...admin, csvUpload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a CSV file to import.' })
  let rows
  try { rows = parseCsv(req.file.buffer.toString('utf8')) } catch (error) { return res.status(400).json({ error: error.message }) }
  if (rows.length < 2) return res.status(400).json({ error: 'The CSV must include a header row and at least one product.' })
  if (rows.length > 1001) return res.status(413).json({ error: 'Import is limited to 1,000 product rows.' })
  const headers = rows[0].map(x=>x.trim().toLowerCase()), required=['name','sku','category','cost','price','stock','min']
  if (required.some(x=>!headers.includes(x))) return res.status(400).json({ error: `CSV headers must include: ${required.join(', ')}.` })
  const records = rows.slice(1).filter(row=>row.some(x=>x.trim())).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]||''])))
  const invalid = records.findIndex(x=>!x.name.trim()||!x.sku.trim()||!x.category.trim()||!Number.isFinite(Number(x.cost))||Number(x.cost)<0||!Number.isFinite(Number(x.price))||Number(x.price)<0||!Number.isInteger(Number(x.stock))||Number(x.stock)<0||!Number.isInteger(Number(x.min))||Number(x.min)<0)
  const skus=records.map(x=>x.sku.trim().toUpperCase())
  if (invalid>=0) return res.status(400).json({ error: `Invalid product fields on CSV data row ${invalid+2}.` })
  if (new Set(skus).size!==skus.length) return res.status(409).json({ error: 'CSV contains duplicate SKUs.' })
  const existing=await Product.find({sku:{$in:skus}}).select('sku').lean()
  if(existing.length) return res.status(409).json({error:`SKU already exists: ${existing[0].sku}. No rows were imported.`})
  const docs=records.map(x=>({name:x.name.trim(),sku:x.sku.trim().toUpperCase(),category:x.category.trim(),brand:x.brand||'',description:x.description||'',barcode:x.barcode||'',supplier:x.supplier||'',warehouse:x.warehouse||'',location:x.location||'',image:x.image||'',cost:Number(x.cost),price:Number(x.price),stock:Number(x.stock),min:Number(x.min)}))
  const created=await Product.insertMany(docs,{ordered:true})
  const openings=created.filter(p=>p.stock).map(p=>({product:p._id,type:'stock-in',quantity:p.stock,before:0,after:p.stock,note:'CSV opening balance',actor:req.user._id}))
  try {
    if(openings.length) await StockMovement.insertMany(openings)
  } catch (error) {
    await Promise.allSettled([Product.deleteMany({ _id: { $in: created.map(product => product._id) } }), StockMovement.deleteMany({ product: { $in: created.map(product => product._id) }, note: 'CSV opening balance' })])
    throw error
  }
  await audit(req,'product.csv-import','Product',created.length,{count:created.length}); res.status(201).json({imported:created.length})
}))
router.get('/products/export.csv', ...admin, asyncRoute(async (_req, res) => {
  const products = await Product.find({ status: 'active' }).sort({ name: 1 }).lean()
  const columns = ['name', 'sku', 'category', 'brand', 'description', 'barcode', 'cost', 'price', 'stock', 'min', 'supplier', 'warehouse', 'location', 'image', 'status']
  const cell = value => {
    let text = String(value ?? '')
    // Prefix spreadsheet formula-like values to prevent CSV formula injection.
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const csv = [columns.map(cell).join(','), ...products.map(product => columns.map(key => cell(product[key])).join(','))].join('\r\n')
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="veltrix-inventory.csv"', 'Cache-Control': 'no-store' }).send(`\uFEFF${csv}`)
}))
function parseCsv(text) { const rows=[]; let row=[],field='',quoted=false; text=text.replace(/^\uFEFF/,''); for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"'){if(field.length)throw new Error('CSV quote found in an unquoted field.');quoted=true}else if(c===','){row.push(field);field=''}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field=''}else field+=c}if(quoted)throw new Error('CSV contains an unclosed quoted field.'); if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row)}return rows }
router.patch('/products/:id', ...admin, asyncRoute(async (req, res) => { const product = await Product.findByIdAndUpdate(req.params.id, { $set: pickProduct(req.body, false) }, { new: true, runValidators: true }); if (!product) return res.status(404).json({ error: 'Product not found.' }); await audit(req, 'product.update', 'Product', product._id); res.json({ product: { ...product.toObject(), id: product.id } }) }))
router.delete('/products/:id', ...admin, asyncRoute(async (req, res) => { const product = await Product.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true }); if (!product) return res.status(404).json({ error: 'Product not found.' }); await audit(req, 'product.archive', 'Product', product._id); res.json({ ok: true }) }))
function pickProduct(b, includeStock = true) { return Object.fromEntries(['name', 'description', 'sku', 'barcode', 'category', 'brand', 'image', 'cost', 'price', ...(includeStock ? ['stock'] : []), 'min', 'supplier', 'warehouse', 'location'].filter(k => b[k] !== undefined).map(k => [k, b[k]])) }

router.get('/catalog', ...admin, asyncRoute(async (req, res) => { const type = ['category', 'brand'].includes(req.query.type) ? req.query.type : { $in: ['category', 'brand'] }; const entries = await CatalogEntry.find({ type, status: 'active' }).sort({ name: 1 }).lean(); res.json({ entries }) }))
router.post('/catalog/:type', ...admin, [body('name').trim().isLength({ min: 1, max: 100 })], validate, asyncRoute(async (req, res) => { if (!['category', 'brand'].includes(req.params.type)) return res.status(400).json({ error: 'Catalog type must be category or brand.' }); const entry = await CatalogEntry.create({ type: req.params.type, name: req.body.name, description: String(req.body.description || '').slice(0, 500) }); await audit(req, `catalog.${req.params.type}.create`, 'CatalogEntry', entry._id); res.status(201).json({ entry }) }))
router.patch('/catalog/:id', ...admin, asyncRoute(async (req, res) => { const entry = await CatalogEntry.findByIdAndUpdate(req.params.id, { $set: { ...(req.body.name ? { name: String(req.body.name).trim().slice(0, 100) } : {}), ...(req.body.description !== undefined ? { description: String(req.body.description).slice(0, 500) } : {}) } }, { new: true, runValidators: true }); if (!entry) return res.status(404).json({ error: 'Catalog entry not found.' }); await audit(req, 'catalog.update', 'CatalogEntry', entry._id); res.json({ entry }) }))
router.delete('/catalog/:id', ...admin, asyncRoute(async (req, res) => { const entry = await CatalogEntry.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true }); if (!entry) return res.status(404).json({ error: 'Catalog entry not found.' }); await audit(req, 'catalog.archive', 'CatalogEntry', entry._id); res.json({ ok: true }) }))

router.get('/suppliers', ...admin, asyncRoute(async (_req, res) => res.json({ suppliers: await Supplier.find({ status: 'active' }).sort({ name: 1 }).lean() })))
router.post('/suppliers', ...admin, [body('name').trim().isLength({ min: 1, max: 160 }), body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail()], validate, asyncRoute(async (req, res) => { const supplier = await Supplier.create(pickFields(req.body, ['name', 'contact', 'email', 'phone', 'address', 'notes'])); await audit(req, 'supplier.create', 'Supplier', supplier._id); res.status(201).json({ supplier }) }))
router.patch('/suppliers/:id', ...admin, asyncRoute(async (req, res) => { const supplier = await Supplier.findByIdAndUpdate(req.params.id, { $set: pickFields(req.body, ['name', 'contact', 'email', 'phone', 'address', 'notes', 'status']) }, { new: true, runValidators: true }); if (!supplier) return res.status(404).json({ error: 'Supplier not found.' }); await audit(req, 'supplier.update', 'Supplier', supplier._id); res.json({ supplier }) }))
router.delete('/suppliers/:id', ...admin, asyncRoute(async (req, res) => { const supplier = await Supplier.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true }); if (!supplier) return res.status(404).json({ error: 'Supplier not found.' }); await audit(req, 'supplier.archive', 'Supplier', supplier._id); res.json({ ok: true }) }))

router.get('/warehouses', ...admin, asyncRoute(async (_req, res) => res.json({ warehouses: await Warehouse.find({ status: 'active' }).sort({ name: 1 }).lean() })))
router.post('/warehouses', ...admin, [body('name').trim().isLength({ min: 1, max: 120 }), body('capacity').optional().isInt({ min: 0 })], validate, asyncRoute(async (req, res) => { const warehouse = await Warehouse.create(pickFields(req.body, ['name', 'location', 'capacity'])); await audit(req, 'warehouse.create', 'Warehouse', warehouse._id); res.status(201).json({ warehouse }) }))
router.patch('/warehouses/:id', ...admin, asyncRoute(async (req, res) => { const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, { $set: pickFields(req.body, ['name', 'location', 'capacity', 'status']) }, { new: true, runValidators: true }); if (!warehouse) return res.status(404).json({ error: 'Warehouse not found.' }); await audit(req, 'warehouse.update', 'Warehouse', warehouse._id); res.json({ warehouse }) }))
router.delete('/warehouses/:id', ...admin, asyncRoute(async (req, res) => { const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true }); if (!warehouse) return res.status(404).json({ error: 'Warehouse not found.' }); await audit(req, 'warehouse.archive', 'Warehouse', warehouse._id); res.json({ ok: true }) }))
function pickFields(bodyData, allowed) { return Object.fromEntries(allowed.filter(key => bodyData[key] !== undefined).map(key => [key, bodyData[key]])) }

router.get('/purchase-orders', ...admin, asyncRoute(async (_req, res) => { const orders = await PurchaseOrder.find().populate('createdBy', 'name email').sort({ createdAt: -1 }).limit(200).lean(); res.json({ orders: orders.map(o => ({ ...o, id: o._id })) }) }))
router.post('/purchase-orders', ...admin, [body('supplier').trim().isLength({ min: 1, max: 160 }), body('warehouse').optional({ checkFalsy: true }).isString().isLength({ max: 120 }), body('expectedDate').optional({ checkFalsy: true }).isISO8601().toDate(), body('items').isArray({ min: 1, max: 100 })], validate, asyncRoute(async (req, res) => {
  if (req.body.items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) return res.status(400).json({ error: 'Each purchase order line must be an object.' })
  const ids = req.body.items.map(i => String(i.productId || ''))
  if (ids.some(id => !/^[a-f\d]{24}$/i.test(id)) || new Set(ids).size !== ids.length || req.body.items.some(i => !Number.isInteger(Number(i.quantity)) || Number(i.quantity) < 1 || Number(i.quantity) > 100000)) return res.status(400).json({ error: 'Purchase order requires unique product IDs and quantities from 1 to 100,000.' })
  const products = await Product.find({ _id: { $in: ids }, status: 'active' }); const byId = new Map(products.map(p => [String(p._id), p]))
  if (products.length !== new Set(ids).size) return res.status(400).json({ error: 'One or more products are unavailable.' })
  const items = req.body.items.map(i => { const p = byId.get(String(i.productId)); const quantity = Number(i.quantity); return { product: p._id, name: p.name, sku: p.sku, quantity, receivedQuantity: 0, unitCost: p.cost, lineTotal: Math.round((p.cost * quantity + Number.EPSILON) * 100) / 100 } })
  const subtotal = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100
  const order = await PurchaseOrder.create({ number: `PO-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`, supplier: req.body.supplier, warehouse: String(req.body.warehouse || '').slice(0, 120), expectedDate: req.body.expectedDate || undefined, items, subtotal, status: 'draft', createdBy: req.user._id, statusHistory: [{ status: 'draft', at: new Date(), actor: req.user._id }] })
  await audit(req, 'purchase-order.create', 'PurchaseOrder', order._id, { total: subtotal }); res.status(201).json({ order })
}))
router.patch('/purchase-orders/:id/status', ...admin, [body('status').isIn(['approved', 'ordered', 'in_transit', 'cancelled'])], validate, asyncRoute(async (req, res) => {
  const order = await PurchaseOrder.findById(req.params.id); if (!order) return res.status(404).json({ error: 'Purchase order not found.' })
  const transitions = { draft: ['approved', 'cancelled'], approved: ['ordered', 'cancelled'], ordered: ['in_transit', 'cancelled'], in_transit: [], received: [], cancelled: [] }
  if (!transitions[order.status]?.includes(req.body.status)) return res.status(409).json({ error: `Purchase order cannot move from ${order.status} to ${req.body.status}.` })
  const updated = await PurchaseOrder.findOneAndUpdate({ _id: order._id, status: order.status }, { $set: { status: req.body.status }, $push: { statusHistory: { status: req.body.status, at: new Date(), actor: req.user._id } } }, { new: true })
  if (!updated) return res.status(409).json({ error: 'Purchase order was updated by another request.' })
  await audit(req, 'purchase-order.status', 'PurchaseOrder', order._id, { status: updated.status }); res.json({ order: updated })
}))
router.post('/purchase-orders/:id/receive', ...admin, asyncRoute(async (req, res) => {
  const order = await PurchaseOrder.findById(req.params.id); if (!order) return res.status(404).json({ error: 'Purchase order not found.' })
  if (!['ordered', 'in_transit'].includes(order.status)) return res.status(409).json({ error: 'Only ordered or in-transit purchase orders can be received.' })
  const receiving = await PurchaseOrder.findOneAndUpdate({ _id: order._id, status: order.status }, { $set: { status: 'receiving' } }, { new: true })
  if (!receiving) return res.status(409).json({ error: 'This purchase order is already being received or has already been processed.' })
  const changed = []; let committedOrder
  try {
    for (const item of receiving.items) {
      const updated = await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity }, $set: { ...(receiving.warehouse ? { warehouse: receiving.warehouse } : {}) } }, { new: true })
      if (!updated) throw Object.assign(new Error(`Product ${item.sku} was not found.`), { status: 409 })
      changed.push({ product: item.product, quantity: item.quantity, before: updated.stock - item.quantity, after: updated.stock })
    }
    const movementWrites = await Promise.allSettled(changed.map(x => StockMovement.create({ product: x.product, type: 'stock-in', quantity: x.quantity, before: x.before, after: x.after, note: `Purchase order ${receiving.number}`, actor: req.user._id })))
    const movementFailure = movementWrites.find(result => result.status === 'rejected')
    if (movementFailure) throw movementFailure.reason
    for (const item of receiving.items) item.receivedQuantity = item.quantity
    receiving.status = 'received'; receiving.receivedAt = new Date(); receiving.statusHistory.push({ status: 'received', at: new Date(), actor: req.user._id })
    committedOrder = await receiving.save()
  } catch (error) {
    await Promise.allSettled(changed.map(x => Product.updateOne({ _id: x.product, stock: { $gte: x.quantity } }, { $inc: { stock: -x.quantity } })))
    await StockMovement.deleteMany({ note: `Purchase order ${receiving.number}`, product: { $in: changed.map(x => x.product) } })
    await PurchaseOrder.updateOne({ _id: order._id, status: 'receiving' }, { $set: { status: order.status } })
    throw error
  }
  const sideEffects = await Promise.allSettled([
    audit(req, 'purchase-order.receive', 'PurchaseOrder', order._id, { lines: changed.length }),
    notify({ role: 'admin', title: 'Purchase order received', body: `${order.number} received ${changed.length} product lines and updated inventory.`, kind: 'purchase-order' }),
  ])
  for (const result of sideEffects) if (result.status === 'rejected') console.error('Purchase receipt side effect failed:', result.reason?.message)
  res.json({ order: committedOrder })
}))
router.post('/inventory/:id/adjust', ...admin, [body('quantity').isInt(), body('type').isIn(['stock-in', 'stock-out', 'adjustment', 'return', 'damaged'])], validate, asyncRoute(async (req, res) => {
  const change = Number(req.body.quantity), p = await Product.findById(req.params.id); if (!p) return res.status(404).json({ error: 'Product not found.' })
  const before = p.stock, next = req.body.type === 'adjustment' ? change : before + (['stock-in', 'return'].includes(req.body.type) ? Math.abs(change) : -Math.abs(change))
  if (next < 0) return res.status(400).json({ error: 'Stock cannot be reduced below zero.' })
  const updated = await Product.findOneAndUpdate({ _id: p._id, stock: before }, { $set: { stock: next } }, { new: true })
  if (!updated) return res.status(409).json({ error: 'Stock changed while you were adjusting it. Refresh and try again.' })
  let movement
  try { movement = await StockMovement.create({ product: p._id, type: req.body.type, quantity: next - before, before, after: next, note: String(req.body.note || '').slice(0, 300), actor: req.user._id }) }
  catch (error) { await Product.updateOne({ _id: p._id, stock: next }, { $set: { stock: before } }); throw error }
  await audit(req, 'inventory.adjust', 'Product', p._id, { before: movement.before, after: movement.after, type: movement.type });
  if (next <= p.min) await notify({ role: 'admin', title: next === 0 ? 'Out of stock' : 'Low stock', body: `${p.name}: ${next} units remaining.`, kind: 'inventory' })
  res.json({ product: { ...updated.toObject(), id: updated.id }, movement })
}))
router.get('/inventory/movements', ...admin, asyncRoute(async (req, res) => { const items = await StockMovement.find().populate('product', 'name sku').sort({ createdAt: -1 }).limit(200).lean(); res.json({ movements: items }) }))

router.get('/orders', authenticate, asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
  const filter = req.user.role === 'admin' ? {} : { user: req.user._id }
  if (req.user.role === 'admin') {
    if (['pending', 'approved', 'confirmed', 'processing', 'shipped', 'delivered', 'rejected', 'cancelled'].includes(req.query.status)) filter.status = req.query.status
    if (['pending', 'paid', 'failed', 'refunded'].includes(req.query.paymentStatus)) filter.paymentStatus = req.query.paymentStatus
    if (req.query.q) {
      const q = String(req.query.q).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const users = await User.find({ $or: [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }] }).select('_id').limit(100).lean()
      filter.$or = [{ number: new RegExp(q, 'i') }, { user: { $in: users.map(u => u._id) } }]
    }
    if (req.query.from || req.query.to) {
      const range = {}
      if (req.query.from) { const from = new Date(req.query.from); if (Number.isNaN(from.getTime())) return res.status(400).json({ error: 'Invalid start date.' }); range.$gte = from }
      if (req.query.to) { const to = new Date(req.query.to); if (Number.isNaN(to.getTime())) return res.status(400).json({ error: 'Invalid end date.' }); if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to))) to.setUTCHours(23,59,59,999); range.$lte = to }
      filter.createdAt = range
    }
  }
  const sortKey = ['createdAt', 'total', 'status', 'number'].includes(req.query.sort) ? req.query.sort : 'createdAt'
  const sortDirection = req.query.direction === 'asc' ? 1 : -1
  const [orders, total] = await Promise.all([Order.find(filter).populate('user', 'name email').sort({ [sortKey]: sortDirection }).skip((page - 1) * limit).limit(limit).lean(), Order.countDocuments(filter)])
  res.json({ orders: orders.map(o => ({ ...o, id: o._id, userId: o.user?._id })), page, limit, total, pages: Math.ceil(total / limit) })
}))
router.get('/orders/:id', authenticate, asyncRoute(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...(req.user.role === 'admin' ? {} : { user: req.user._id }) }).populate('user', 'name email').lean()
  if (!order) return res.status(404).json({ error: 'Order not found.' })
  res.json({ order: { ...order, id: order._id, userId: order.user?._id } })
}))
router.get('/payments/transactions', authenticate, asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25))
  const filter = { ...(req.user.role === 'admin' ? {} : { user: req.user._id }) }
  if (['pending', 'paid', 'refunded', 'failed'].includes(req.query.status)) filter.paymentStatus = req.query.status
  const offset = (page - 1) * limit
  const failedFilter = { ...(req.user.role === 'admin' ? {} : { user: req.user._id }) }
  if (req.query.status && req.query.status !== 'failed') failedFilter._id = { $exists: false }
  const [transactions, orderCount, attemptCount] = await Promise.all([
    Order.aggregate([
      { $match: filter },
      { $project: { number: 1, user: 1, paymentMethod: 1, paymentStatus: 1, paymentReference: 1, paymentHistory: 1, total: 1, createdAt: 1, updatedAt: 1 } },
      { $unionWith: { coll: FailedPaymentAttempt.collection.name, pipeline: [
        { $match: failedFilter },
        { $addFields: { number: { $concat: ['DECLINED-', { $toUpper: { $substrBytes: [{ $toString: '$_id' }, 16, 8] } }] } } },
        { $project: { number: 1, user: 1, paymentMethod: 1, paymentStatus: 1, paymentReference: 1, failureReason: 1, total: 1, createdAt: 1, updatedAt: 1 } },
      ] } },
      { $sort: { createdAt: -1, _id: -1 } }, { $skip: offset }, { $limit: limit },
      { $lookup: { from: User.collection.name, localField: 'user', foreignField: '_id', as: 'userInfo' } },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      { $addFields: { user: { _id: '$userInfo._id', name: '$userInfo.name', email: '$userInfo.email' } } },
      { $project: { userInfo: 0 } },
    ]),
    Order.countDocuments(filter), FailedPaymentAttempt.countDocuments(failedFilter),
  ])
  const total = orderCount + attemptCount
  res.json({ transactions, page, limit, total, pages: Math.ceil(total / limit) })
}))
router.post('/orders', authenticate, [body('items').isArray({ min: 1, max: 50 }), body('paymentMethod').isIn(['card-demo', 'cod']), body('idempotencyKey').optional().isString().isLength({ min: 8, max: 100 })], validate, asyncRoute(async (req, res) => {
  const idempotencyKey = req.body.idempotencyKey?.trim()
  if (idempotencyKey) {
    const priorOrder = await Order.findOne({ user: req.user._id, idempotencyKey })
    if (priorOrder) return res.json({ order: { ...priorOrder.toObject(), id: priorOrder.id }, replayed: true })
  }
  const rawItems = req.body.items
  if (rawItems.some(item => !item || typeof item !== 'object' || Array.isArray(item))) return res.status(400).json({ error: 'Each order line must be an object.' })
  const ids = rawItems.map(i => String(i.productId || ''))
  if (ids.some(id => !/^[a-f\d]{24}$/i.test(id)) || rawItems.some(i => !Number.isInteger(Number(i.quantity)) || Number(i.quantity) < 1 || Number(i.quantity) > 10000)) return res.status(400).json({ error: 'Order items contain an invalid product or quantity.' })
  const products = await Product.find({ _id: { $in: ids }, status: 'active' }); const byId = new Map(products.map(p => [String(p._id), p]))
  if (products.length !== new Set(ids).size) return res.status(400).json({ error: 'One or more products are unavailable.' })
  const items = rawItems.map((i, index) => { const p = byId.get(ids[index]); const quantity = Number(i.quantity); return { product: p._id, name: p.name, sku: p.sku, quantity, unitPrice: p.price, lineTotal: Math.round((p.price * quantity + Number.EPSILON) * 100) / 100 } })
  const subtotal = Math.round(items.reduce((n, i) => n + i.lineTotal, 0) * 100) / 100, tax = Math.round((subtotal * 0.08 + Number.EPSILON) * 100) / 100, shipping = subtotal >= 100 ? 0 : 12, total = Math.round((subtotal + tax + shipping) * 100) / 100
  const address = req.body.address || {}
  if (typeof address !== 'object' || Array.isArray(address)) return res.status(400).json({ error: 'Delivery address must be an object.' })
  const addressLimits = { name: 100, phone: 30, line1: 200, city: 100, region: 100, postalCode: 20, country: 100 }
  if (Object.entries(address).some(([key, value]) => !(key in addressLimits) || typeof value !== 'string' || value.length > addressLimits[key])) return res.status(400).json({ error: 'Delivery address contains an unsupported or overlong field.' })
  if (req.body.paymentMethod === 'cod' && ['name', 'phone', 'line1', 'city', 'country'].some(key => !address[key]?.trim())) return res.status(400).json({ error: 'A name, delivery address, phone, city, and country are required for COD.' })
  let paymentStatus = req.body.paymentMethod === 'cod' ? 'pending' : 'failed', paymentReference = ''
  if (req.body.paymentMethod === 'card-demo') {
    const card = req.body.card || {}
    // Test only: consume card fields in memory and never save/log the raw PAN or CVV.
    const expiry = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(card.expiry || '')
    const expiryDate = expiry && new Date(2000 + Number(expiry[2]), Number(expiry[1]), 1)
    if (!/^4242424242424242$|^4000000000000002$/.test(String(card.number || '').replace(/\s/g, '')) || !expiryDate || expiryDate <= new Date(new Date().getFullYear(), new Date().getMonth(), 1) || !/^\d{3,4}$/.test(card.cvv || '') || !String(card.name || '').trim()) return res.status(400).json({ error: 'Use the simulator test card 4242 4242 4242 4242 (success) or 4000 0000 0000 0002 (decline), a future MM/YY and a fictional CVV.' })
    if (String(card.number).replace(/\s/g, '') === '4000000000000002') paymentStatus = 'failed'
    else { paymentStatus = 'paid'; paymentReference = `SIM-${crypto.randomBytes(6).toString('hex').toUpperCase()}` }
  }
  if (paymentStatus === 'failed') {
    const paymentReference = `SIM-DECLINED-${crypto.randomBytes(6).toString('hex').toUpperCase()}`
    await FailedPaymentAttempt.create({ user: req.user._id, paymentReference, total, failureReason: 'simulated_decline' })
    return res.status(402).json({ error: 'The test payment was declined. The failed test attempt was saved; no order was created.' })
  }
  const changed = []
  const number = `SO-${Date.now().toString().slice(-8)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
  let createdOrder
  try {
    for (const item of items) {
      const product = await Product.findOneAndUpdate({ _id: item.product, stock: { $gte: item.quantity }, status: 'active' }, { $inc: { stock: -item.quantity } }, { new: true })
      if (!product) throw Object.assign(new Error(`Not enough stock for ${item.name}.`), { status: 409 })
      changed.push({ product: item.product, quantity: item.quantity, before: product.stock + item.quantity, after: product.stock })
    }
    const paymentAt = new Date()
    createdOrder = await Order.create({ number, user: req.user._id, ...(idempotencyKey ? { idempotencyKey } : {}), items, subtotal, tax, shipping, total, paymentMethod: req.body.paymentMethod, paymentStatus, paymentReference, ...(paymentStatus === 'paid' ? { paidAt: paymentAt } : {}), paymentHistory: [{ status: paymentStatus, reference: paymentReference, at: paymentAt, actor: req.user._id }], address: Object.fromEntries(Object.entries(address).map(([key, value]) => [key, value.trim()])), status: 'pending', statusHistory: [{ status: 'pending', at: paymentAt, actor: req.user._id }] })
    const movementWrites = await Promise.allSettled(changed.map(item => StockMovement.create({ product: item.product, type: 'stock-out', quantity: -item.quantity, before: item.before, after: item.after, note: `Customer order ${number}`, actor: req.user._id })))
    const movementFailure = movementWrites.find(result => result.status === 'rejected')
    if (movementFailure) throw movementFailure.reason
  } catch (error) {
    await Promise.allSettled(changed.map(x => Product.updateOne({ _id: x.product }, { $inc: { stock: x.quantity } })))
    if (createdOrder) await Order.deleteOne({ _id: createdOrder._id })
    await StockMovement.deleteMany({ note: `Customer order ${number}`, actor: req.user._id })
    if (error.code === 11000 && idempotencyKey) {
      const priorOrder = await Order.findOne({ user: req.user._id, idempotencyKey })
      if (priorOrder) return res.json({ order: { ...priorOrder.toObject(), id: priorOrder.id }, replayed: true })
    }
    throw error
  }
  await notify({ role: 'admin', title: 'New customer order', body: `${number} · ${req.user.name} · $${total.toFixed(2)}`, kind: 'order' })
  res.status(201).json({ order: { ...createdOrder.toObject(), id: createdOrder.id } })
}))
router.patch('/orders/:id/status', ...admin, [body('status').isIn(['approved', 'confirmed', 'processing', 'shipped', 'delivered', 'rejected', 'cancelled']), body('paymentStatus').optional().isIn(['paid', 'failed', 'refunded']), body('reason').optional().isString().trim().isLength({ max: 500 })], validate, asyncRoute(async (req, res) => {
  const order = await Order.findById(req.params.id); if (!order) return res.status(404).json({ error: 'Order not found.' })
  if (req.body.paymentStatus && (!['cancelled', 'rejected'].includes(req.body.status) || order.paymentMethod !== 'card-demo' || req.body.paymentStatus !== 'refunded' || order.paymentStatus !== 'paid')) return res.status(409).json({ error: 'A paid demo-card order can only be refunded when it is cancelled or rejected.' })
  if (req.body.status === 'rejected' && !req.body.reason?.trim()) return res.status(400).json({ error: 'A reason is required when rejecting an order.' })
  const transitions = { pending: ['approved', 'confirmed', 'rejected', 'cancelled'], approved: ['confirmed', 'processing', 'cancelled'], confirmed: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'] }
  if (!transitions[order.status]?.includes(req.body.status)) return res.status(409).json({ error: `Order cannot move from ${order.status} to ${req.body.status}.` })
  const refund = ['cancelled', 'rejected'].includes(req.body.status) && order.paymentMethod === 'card-demo' && order.paymentStatus === 'paid'
  const now = new Date()
  const updated = await Order.findOneAndUpdate({ _id: order._id, status: order.status }, { $set: { status: req.body.status, ...(req.body.status === 'rejected' ? { rejectionReason: req.body.reason.trim() } : {}), ...(refund ? { paymentStatus: 'refunded', refundedAt: now } : {}) }, $push: { statusHistory: { status: req.body.status, at: now, actor: req.user._id }, ...(refund ? { paymentHistory: { status: 'refunded', reference: order.paymentReference, at: now, actor: req.user._id } } : {}) } }, { new: true })
  if (!updated) return res.status(409).json({ error: 'The order was updated by another request. Refresh and try again.' })
  if (['cancelled', 'rejected'].includes(req.body.status)) { await Promise.all(order.items.map(async i => { const updatedProduct = await Product.findByIdAndUpdate(i.product, { $inc: { stock: i.quantity } }, { new: true }); if (updatedProduct) await StockMovement.create({ product: i.product, type: 'return', quantity: i.quantity, before: updatedProduct.stock - i.quantity, after: updatedProduct.stock, note: `${req.body.status === 'rejected' ? 'Rejection' : 'Cancellation'} ${order.number}`, actor: req.user._id }) })) }
  await notify({ user: order.user, role: 'user', title: 'Order status updated', body: `${order.number} is now ${updated.status}.`, kind: 'order' }); await audit(req, 'order.status', 'Order', order._id, { status: updated.status, paymentStatus: updated.paymentStatus }); res.json({ order: updated })
}))
router.patch('/orders/:id/collect-cod', ...admin, asyncRoute(async (req, res) => { const order = await Order.findById(req.params.id); if (!order) return res.status(404).json({ error: 'Order not found.' }); if (order.paymentMethod !== 'cod' || order.status !== 'delivered' || order.paymentStatus !== 'pending') return res.status(409).json({ error: 'COD can be marked collected only after delivery and while payment is pending.' }); const now = new Date(); const updated = await Order.findOneAndUpdate({ _id: order._id, paymentMethod: 'cod', status: 'delivered', paymentStatus: 'pending' }, { $set: { paymentStatus: 'paid', paidAt: now }, $push: { paymentHistory: { status: 'paid', at: now, actor: req.user._id } } }, { new: true }); if (!updated) return res.status(409).json({ error: 'Payment status was updated by another request.' }); await audit(req, 'payment.cod-collected', 'Order', order._id, { total: order.total }); await notify({ user: order.user, role: 'user', title: 'COD payment collected', body: `${order.number} payment was marked collected.`, kind: 'payment' }); res.json({ order: updated }) }))

router.get('/admin/users', ...admin, asyncRoute(async (req, res) => { const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50)), q = String(req.query.q || '').slice(0, 100); const filter = q ? { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { email: new RegExp(escapeRegex(q), 'i') }] } : {}; if (['active','disabled','suspended'].includes(req.query.status)) filter.status = req.query.status; if (['admin','user'].includes(req.query.role)) filter.role = req.query.role; const sort = ['name','createdAt','lastLoginAt','status'].includes(req.query.sort) ? req.query.sort : 'createdAt'; const direction = req.query.direction === 'asc' ? 1 : -1; const [users, total] = await Promise.all([User.find(filter).select('-password').sort({ [sort]: direction }).skip((page - 1) * limit).limit(limit), User.countDocuments(filter)]); res.json({ users: users.map(safeUser), total, page, limit, pages: Math.ceil(total / limit) }) }))
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
router.get('/admin/users/:id', ...admin, asyncRoute(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password').lean()
  if (!user) return res.status(404).json({ error: 'User not found.' })
  const [orders, activity] = await Promise.all([
    Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).select('number status paymentMethod paymentStatus total createdAt').lean(),
    AuditLog.find({ actor: user._id }).sort({ createdAt: -1 }).limit(50).select('action entity entityId details createdAt').lean(),
  ])
  res.json({ user: safeUser(user), orders, activity })
}))
router.patch('/admin/users/:id', ...admin, [body('name').optional().trim().isLength({ min: 2, max: 100 }), body('email').optional().isEmail().normalizeEmail(), body('role').optional().isIn(['admin', 'user'])], validate, asyncRoute(async (req, res) => {
  const target = await User.findById(req.params.id)
  if (!target) return res.status(404).json({ error: 'User not found.' })
  const fields = ['name', 'email', 'role'].filter(key => req.body[key] !== undefined)
  if (!fields.length) return res.status(400).json({ error: 'Provide a name, email, or role to update.' })
  const removesAdmin = target.role === 'admin' && target.status === 'active' && (req.body.role === 'user' || req.body.status === 'disabled' || req.body.status === 'suspended')
  if (removesAdmin && await User.countDocuments({ role: 'admin', status: 'active' }) <= 1) return res.status(409).json({ error: 'The final active administrator cannot be demoted or disabled.' })
  for (const key of fields) target[key] = req.body[key]
  await target.save()
  await audit(req, 'user.update', 'User', target._id, { fields })
  res.json({ user: safeUser(target) })
}))
router.patch('/admin/users/:id/status', ...admin, [body('status').isIn(['active', 'disabled', 'suspended'])], validate, asyncRoute(async (req, res) => { const target = await User.findById(req.params.id); if (!target) return res.status(404).json({ error: 'User not found.' }); if (target.role === 'admin' && target.status === 'active' && req.body.status !== 'active' && await User.countDocuments({ role: 'admin', status: 'active' }) <= 1) return res.status(409).json({ error: 'The final active administrator cannot be disabled.' }); target.status = req.body.status; await target.save(); await audit(req, 'user.status', 'User', target._id, { status: target.status }); await notify({ user: target._id, role: 'user', title: 'Account status updated', body: `Your account is ${target.status}.`, kind: 'account' }); res.json({ user: safeUser(target) }) }))
router.get('/notifications', authenticate, asyncRoute(async (req, res) => { const filter = req.user.role === 'admin' ? { $or: [{ role: 'admin' }, { role: 'all' }, { user: req.user._id }] } : { $or: [{ role: 'all' }, { user: req.user._id }] }; const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(100).lean(); res.json({ notifications, unread: notifications.filter(n => !n.readAt).length }) }))
router.patch('/notifications/:id/read', authenticate, asyncRoute(async (req, res) => { const n = await Notification.findOneAndUpdate({ _id: req.params.id, $or: [{ role: 'all' }, { role: req.user.role }, { user: req.user._id }] }, { $set: { readAt: new Date() } }, { new: true }); if (!n) return res.status(404).json({ error: 'Notification not found.' }); res.json({ notification: n }) }))
router.get('/reports/summary', ...admin, asyncRoute(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : null
  const to = req.query.to ? new Date(req.query.to) : null
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) return res.status(400).json({ error: 'Report date range is invalid.' })
  const dateRange = {}
  if (from) dateRange.$gte = from
  if (to) { if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to))) to.setUTCHours(23,59,59,999); dateRange.$lte = to }
  const period = Object.keys(dateRange).length ? { createdAt: dateRange } : {}
  const productFilter = { status: 'active', ...(req.query.category ? { category: String(req.query.category).slice(0, 100) } : {}) }
  const [inventory, sales, users, activeUsers, disabledUsers, paymentStats, lowStock, movements] = await Promise.all([
    Product.aggregate([{ $match: productFilter }, { $group: { _id: null, products: { $sum: 1 }, categories: { $addToSet: '$category' }, inventoryValue: { $sum: { $multiply: ['$stock', '$cost'] } }, units: { $sum: '$stock' } } }]),
    Order.aggregate([{ $match: period }, { $group: { _id: null, orders: { $sum: 1 }, pendingOrders: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }, revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] } } } }]),
    User.countDocuments(period), User.countDocuments({ ...period, status: 'active' }), User.countDocuments({ ...period, status: { $in: ['disabled', 'suspended'] } }),
    Order.aggregate([{ $match: period }, { $group: { _id: null, paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } }, pending: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] } }, refunded: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'failed'] }, 1, 0] } } } }]),
    Product.countDocuments({ ...productFilter, $expr: { $lte: ['$stock', '$min'] } }),
    StockMovement.countDocuments(period),
  ])
  const stock = inventory[0] || { products: 0, categories: [], inventoryValue: 0, units: 0 }
  const orders = sales[0] || { orders: 0, pendingOrders: 0, revenue: 0 }
  const payments = paymentStats[0] || { paid: 0, pending: 0, refunded: 0, failed: 0 }
  res.json({ metrics: { products: stock.products, categories: stock.categories.length, inventoryValue: stock.inventoryValue, units: stock.units, orders: orders.orders, pendingOrders: orders.pendingOrders, revenue: orders.revenue, users, activeUsers, disabledUsers, payments, lowStock, movements }, filters: { from: from?.toISOString() || null, to: to?.toISOString() || null, category: req.query.category || null } })
}))
router.get('/admin/audit', ...admin, asyncRoute(async (_req, res) => { const logs = await AuditLog.find().populate('actor', 'name email').sort({ createdAt: -1 }).limit(200).lean(); res.json({ logs }) }))
router.get('/health', (_req, res) => { const connected = mongoose.connection.readyState === 1; res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'degraded', database: connected ? 'connected' : 'disconnected', timestamp: new Date().toISOString() }) })

export default router
