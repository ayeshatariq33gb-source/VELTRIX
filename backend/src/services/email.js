import nodemailer from 'nodemailer'

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM)
}
function transport() {
  if (!isEmailConfigured()) throw new Error('SMTP is not configured.')
  return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
}
async function send(to, subject, text) { await transport().sendMail({ from: process.env.EMAIL_FROM, to, subject, text }) }
const actionUrl = (path, token) => { const url = new URL(path, process.env.FRONTEND_ORIGIN); url.searchParams.set('token', token); return url.toString() }
export const sendResetEmail = (to, token) => send(to, 'Reset your VELTRIX password', `Use this link within 30 minutes to reset your password:\n${actionUrl('/reset-password', token)}\n\nIf you did not request this, ignore this email.`)
export const sendVerificationEmail = (to, token) => send(to, 'Verify your VELTRIX account', `Verify your email within 24 hours:\n${actionUrl('/verify-email', token)}\n\nIf you did not create this account, ignore this email.`)
