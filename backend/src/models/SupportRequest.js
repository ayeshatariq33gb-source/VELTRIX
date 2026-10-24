import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  category: { type: String, enum: ['account', 'order', 'inventory', 'other'], default: 'other' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open', index: true },
  adminNote: { type: String, default: '', maxlength: 2000 },
  history: [{ status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'] }, note: { type: String, maxlength: 2000 }, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
}, { timestamps: true })

schema.index({ createdAt: -1 })
export default mongoose.model('SupportRequest', schema)
