import mongoose from 'mongoose'
const schema = new mongoose.Schema({ name: { type: String, required: true, trim: true, unique: true, maxlength: 120 }, location: { type: String, default: '', maxlength: 200 }, capacity: { type: Number, min: 0, default: 0 }, status: { type: String, enum: ['active', 'inactive'], default: 'active' } }, { timestamps: true })
export default mongoose.model('Warehouse', schema)
