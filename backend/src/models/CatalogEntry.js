import mongoose from 'mongoose'
const schema = new mongoose.Schema({ type: { type: String, enum: ['category', 'brand'], required: true }, name: { type: String, required: true, trim: true, maxlength: 100 }, description: { type: String, maxlength: 500, default: '' }, status: { type: String, enum: ['active', 'archived'], default: 'active' } }, { timestamps: true })
schema.index({ type: 1, name: 1 }, { unique: true })
export default mongoose.model('CatalogEntry', schema)
