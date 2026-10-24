import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
  number: { type: String, unique: true, index: true }, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, idempotencyKey: { type: String, trim: true, maxlength: 100 },
  items: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, name: String, sku: String, quantity: { type: Number, min: 1 }, unitPrice: { type: Number, min: 0 }, lineTotal: Number }],
  subtotal: Number, tax: Number, shipping: Number, total: Number,
  paymentMethod: { type: String, enum: ['card-demo', 'cod'], required: true }, paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' }, paymentReference: String, paidAt: Date, refundedAt: Date,
  paymentHistory: [{ status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'] }, reference: String, at: { type: Date, default: Date.now }, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
  status: { type: String, enum: ['pending', 'approved', 'confirmed', 'processing', 'shipped', 'delivered', 'rejected', 'cancelled'], default: 'pending' },
  rejectionReason: { type: String, default: '', maxlength: 500 },
  address: { name: String, phone: String, line1: String, city: String, region: String, postalCode: String, country: String }, statusHistory: [{ status: String, at: Date, actor: mongoose.Schema.Types.ObjectId }],
}, { timestamps: true })
orderSchema.index({ user: 1, createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })
orderSchema.index({ paymentStatus: 1, updatedAt: -1 })
orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } })
export default mongoose.model('Order', orderSchema)
