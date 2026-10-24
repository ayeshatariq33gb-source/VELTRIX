import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, minlength: 8, maxlength: 128, select: false, validate: { validator: value => Buffer.byteLength(value, 'utf8') <= 72, message: 'Password must not exceed 72 UTF-8 bytes.' } },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  status: { type: String, enum: ['active', 'disabled', 'suspended'], default: 'active' },
  avatar: { type: String, default: '' },
  phone: { type: String, default: '', maxlength: 30 },
  address: { line1: { type: String, default: '', maxlength: 200 }, city: { type: String, default: '', maxlength: 100 }, region: { type: String, default: '', maxlength: 100 }, postalCode: { type: String, default: '', maxlength: 20 }, country: { type: String, default: '', maxlength: 100 } },
  emailVerified: { type: Boolean, default: true },
  verificationTokenHash: String,
  verificationTokenExpires: Date,
  resetTokenHash: String,
  resetTokenExpires: Date,
  passwordChangedAt: Date,
  lastLoginAt: Date,
}, { timestamps: true })

userSchema.pre('save', async function () { if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12) })
userSchema.methods.checkPassword = function (plain) { return bcrypt.compare(plain, this.password) }
export default mongoose.model('User', userSchema)
