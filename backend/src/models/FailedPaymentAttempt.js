import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  paymentMethod: { type: String, enum: ['card-demo'], default: 'card-demo' },
  paymentStatus: { type: String, enum: ['failed'], default: 'failed' },
  paymentReference: { type: String, required: true, unique: true },
  total: { type: Number, min: 0, required: true },
  failureReason: { type: String, maxlength: 100, default: 'simulated_decline' },
}, { timestamps: true })

schema.index({ user: 1, createdAt: -1 })
export default mongoose.model('FailedPaymentAttempt', schema)
