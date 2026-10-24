import mongoose from 'mongoose'
export default mongoose.model('Notification', new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, role: { type: String, enum: ['admin', 'user', 'all'], default: 'all' }, title: String, body: String, kind: { type: String, default: 'info' }, readAt: Date }, { timestamps: true }))
