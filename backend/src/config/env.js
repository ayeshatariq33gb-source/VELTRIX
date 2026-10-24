export function validateEnvironment(env = process.env) {
  const errors = []
  const secret = env.JWT_SECRET || ''
  if (secret.length < 32 || /replace-with|change-me|example/i.test(secret)) errors.push('JWT_SECRET must be a unique random value of at least 32 characters.')
  if (!/^mongodb(?:\+srv)?:\/\//i.test(env.MONGODB_URI || '')) errors.push('MONGODB_URI must be a valid mongodb:// or mongodb+srv:// URI.')
  if (env.JWT_EXPIRES_IN && !/^\d+(ms|s|m|h|d|w|y)?$/i.test(env.JWT_EXPIRES_IN)) errors.push('JWT_EXPIRES_IN must be a numeric duration such as 8h or 3600.')

  const port = Number(env.PORT || 4000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be an integer from 1 to 65535.')
  if (env.TRUST_PROXY && env.TRUST_PROXY !== 'true' && env.TRUST_PROXY !== 'false' && !/^\d+$/.test(env.TRUST_PROXY)) errors.push('TRUST_PROXY must be true, false, or a non-negative hop count.')

  for (const name of ['FRONTEND_ORIGIN', 'BACKEND_ORIGIN']) {
    if (!env[name]) continue
    try {
      const url = new URL(env[name])
      if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) throw new Error()
      if (env.NODE_ENV === 'production' && url.protocol !== 'https:') errors.push(`${name} must use HTTPS in production.`)
    } catch {
      errors.push(`${name} must be an origin URL, such as https://app.example.com.`)
    }
  }
  if (env.NODE_ENV === 'production' && (!env.FRONTEND_ORIGIN || !env.BACKEND_ORIGIN)) errors.push('FRONTEND_ORIGIN and BACKEND_ORIGIN are required in production.')

  const smtpValues = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter(name => Boolean(env[name]))
  if (smtpValues.length > 0 && smtpValues.length < 3) errors.push('SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured together.')
  if (smtpValues.length === 3 && !env.EMAIL_FROM) errors.push('EMAIL_FROM is required when SMTP is configured.')
  if (env.NODE_ENV === 'production' && smtpValues.length !== 3) errors.push('SMTP must be configured in production for account verification and password recovery.')
  if (env.SMTP_SECURE && !['true', 'false'].includes(env.SMTP_SECURE)) errors.push('SMTP_SECURE must be true or false.')
  if (env.SMTP_PORT && (!Number.isInteger(Number(env.SMTP_PORT)) || Number(env.SMTP_PORT) < 1 || Number(env.SMTP_PORT) > 65535)) errors.push('SMTP_PORT must be an integer from 1 to 65535.')

  if (errors.length) throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`)
  return { port }
}
