import 'dotenv/config'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Product from '../models/Product.js'
import StockMovement from '../models/StockMovement.js'
import Supplier from '../models/Supplier.js'
import Warehouse from '../models/Warehouse.js'
import CatalogEntry from '../models/CatalogEntry.js'
import { validateEnvironment } from '../config/env.js'

validateEnvironment()
if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding.')
if (process.env.SEED_ADMIN_PASSWORD.length < 12 || /replace-with|change-me|example|password123/i.test(process.env.SEED_ADMIN_PASSWORD)) throw new Error('Set a unique SEED_ADMIN_PASSWORD with at least 12 characters; the example value is not allowed.')

await mongoose.connect(process.env.MONGODB_URI)
try {
  const email = process.env.SEED_ADMIN_EMAIL.trim().toLowerCase()
  let admin = await User.findOne({ email }).select('+password')
  if (admin && admin.role !== 'admin') throw new Error('SEED_ADMIN_EMAIL already belongs to a non-admin account.')
  if (!admin) {
    admin = new User({ name: 'VELTRIX Admin', email, password: process.env.SEED_ADMIN_PASSWORD, role: 'admin', status: 'active', emailVerified: true })
    await admin.save()
  }

  const products = [
    ['Studio Headphones', 'AUR-HX-2048', 'Audio', 'Auraline', 289, 146, 84, 20, 'photo-1505740420928-5e560c06d30e'],
    ['Arc Desk Lamp', 'FRM-LP-041', 'Workspace', 'Forma', 198, 92, 12, 18, 'photo-1507473885765-e6ed057f782c'],
    ['Everyday Carry Tote', 'CGD-CT-092', 'Accessories', 'Common Ground', 86, 29, 156, 32, 'photo-1590874103328-eac38a683ce7'],
    ['Ridge Ceramic Set', 'NOM-CR-305', 'Home', 'Studio Noma', 124, 58, 0, 14, 'photo-1490312278390-ab64016e0aa9'],
    ['Alto Wireless Speaker', 'AUR-SP-118', 'Audio', 'Auraline', 349, 181, 48, 16, 'photo-1608043152269-423dbba4e7e1'],
    ['Field Notes Journal', 'PAP-JR-070', 'Stationery', 'Paper People', 32, 8, 9, 24, 'photo-1531346878377-a5be20888e57'],
  ].map(([name, sku, category, brand, price, cost, stock, min, image]) => ({ name, sku, category, brand, price, cost, stock, min, image, supplier: `${brand} Supply Co.`, warehouse: 'Northstar Warehouse' }))

  for (const product of products) {
    const existing = await Product.findOne({ sku: product.sku })
    if (existing) continue
    const created = await Product.create(product)
    if (created.stock) await StockMovement.create({ product: created._id, type: 'stock-in', quantity: created.stock, before: 0, after: created.stock, note: 'Seed opening balance', actor: admin._id })
  }
  for (const [name, email] of [['Auraline Supply Co.', 'hello@auraline.co'], ['Forma Living', 'orders@formaliving.com'], ['Common Ground Studio', 'team@commonground.co'], ['Studio Noma', 'supply@studionoma.com'], ['Paper People Inc.', 'hello@paperpeople.co']]) {
    await Supplier.updateOne({ name }, { $setOnInsert: { name, email } }, { upsert: true })
  }
  await Warehouse.updateOne({ name: 'Northstar Warehouse' }, { $setOnInsert: { name: 'Northstar Warehouse', location: 'Austin, TX', capacity: 2500 } }, { upsert: true })
  for (const name of new Set(products.map(product => product.category))) await CatalogEntry.updateOne({ type: 'category', name }, { $setOnInsert: { type: 'category', name } }, { upsert: true })
  for (const name of new Set(products.map(product => product.brand))) await CatalogEntry.updateOne({ type: 'brand', name }, { $setOnInsert: { type: 'brand', name } }, { upsert: true })
  console.log(`Seeded admin account ${email} and sample inventory.`)
} finally {
  await mongoose.disconnect()
}
