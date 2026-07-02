import app, { connectDatabase } from './server/app.js'

connectDatabase().catch((error) => {
  console.error('MongoDB connection failed:', error.message)
})

export default app
