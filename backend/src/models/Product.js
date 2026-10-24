import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 }, description: { type: String, maxlength: 3000, default: '' },
  sku: { type: String, required: true, uppercase: true, trim: true, unique: true, maxlength: 80, index: true }, barcode: { type: String, trim: true, default: '', maxlength: 80 },
  category: { type: String, required: true, trim: true, maxlength: 100 }, brand: { type: String, default: '', maxlength: 100 }, image: { type: String, default: '', maxlength: 500 },
  cost: { type: Number, min: 0, required: true }, price: { type: Number, min: 0, required: true }, stock: { type: Number, min: 0, default: 0 }, min: { type: Number, min: 0, default: 0 },
  supplier: { type: String, default: '', maxlength: 160 }, warehouse: { type: String, default: '', maxlength: 120 }, location: { type: String, default: '', maxlength: 120 }, status: { type: String, enum: ['active', 'archived'], default: 'active' },
}, { timestamps: true })
productSchema.index({ name: 'text', sku: 'text', brand: 'text', category: 'text' })
export default mongoose.model('Product', productSchema)
