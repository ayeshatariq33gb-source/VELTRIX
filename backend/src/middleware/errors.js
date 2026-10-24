export function notFound(req, res) { res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` }) }
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)
  const status = err.name === 'ValidationError' || err.name === 'CastError' || err.name === 'MulterError' ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : err.code === 11000 ? 409 : err.status || 500
  const message = err.code === 11000 ? 'A record with that unique value already exists.' : status >= 500 ? 'An unexpected server error occurred.' : err.message
  if (status >= 500) console.error(err)
  res.status(status).json({ error: message })
}
