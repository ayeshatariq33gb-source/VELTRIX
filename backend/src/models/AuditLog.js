import mongoose from 'mongoose'
export default mongoose.model('AuditLog', new mongoose.Schema({ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, action: { type: String, required: true }, entity: String, entityId: String, details: mongoose.Schema.Types.Mixed, ip: String }, { timestamps: true }))
