import mongoose from 'mongoose'

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required')
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
    console.log(`MongoDB connected successfully: ${mongoose.connection.name}`)
  } catch (error) {
    // Mongo errors can contain connection details. Report actionable causes without the URI.
    if (error?.code === 8000 || error?.codeName === 'AtlasError' || /authentication failed|bad auth/i.test(error?.message || '')) {
      throw new Error('MongoDB Atlas rejected the database username or password. Check the Atlas Database Access user and URL-encode any reserved password characters.')
    }
    if (/ENOTFOUND|getaddrinfo|querySrv/i.test(error?.message || '')) {
      throw new Error('MongoDB host could not be resolved. Check the cluster hostname and DNS/network access.')
    }
    throw new Error(`MongoDB connection failed (${error?.name || 'unknown error'}). Check the URI, network access, and Atlas IP access list.`)
  }
  return mongoose.connection
}
