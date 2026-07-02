import app from './app.js'

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`API running on http://127.0.0.1:${PORT}`)
})
