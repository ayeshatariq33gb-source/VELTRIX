import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || fileURLToPath(new URL('../../uploads/', import.meta.url)))
fs.mkdirSync(uploadDirectory, { recursive: true })
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }
export const imageUpload = multer({ storage: multer.diskStorage({ destination: uploadDirectory, filename: (_req, file, done) => done(null, `${crypto.randomUUID()}${extensions[file.mimetype] || '.bin'}`) }), limits: { fileSize: 4 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, done) => extensions[file.mimetype] ? done(null, true) : done(Object.assign(new Error('Upload a JPEG, PNG, WebP, or GIF image.'), { status: 400 })) })
export const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, done) => { const okay = file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv'; done(okay ? null : Object.assign(new Error('Upload a .csv file.'), { status: 400 }), okay) } })
