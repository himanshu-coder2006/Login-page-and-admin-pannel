import app, { connectDatabase } from './app.js'

const PORT = process.env.PORT || 5000

connectDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API running on http://127.0.0.1:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })
