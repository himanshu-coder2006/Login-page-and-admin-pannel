import app, { connectDatabase } from './app.js'

const PORT = process.env.PORT || 5000

connectDatabase()
  .then(() => {
    console.log('MongoDB connected')
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message)
    console.error('Using local file store until MongoDB is available')
  })

app.listen(PORT, () => {
  console.log(`API running on http://127.0.0.1:${PORT}`)
})
