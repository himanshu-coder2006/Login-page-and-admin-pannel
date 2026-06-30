import bcrypt from 'bcryptjs'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mern-login-app'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

app.use(cors())
app.use(express.json())

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
)

const User = mongoose.model('User', userSchema)

const loginLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ['register', 'login'],
      default: 'login',
    },
  },
  { timestamps: true },
)

const LoginLog = mongoose.model('LoginLog', loginLogSchema)

const createUserToken = (userId) =>
  jwt.sign({ userId, role: 'user' }, JWT_SECRET, { expiresIn: '7d' })

const createAdminToken = () =>
  jwt.sign({ email: ADMIN_EMAIL, role: 'admin' }, JWT_SECRET, { expiresIn: '2h' })

const toSafeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
  loginCount: user.loginCount,
})

const requireAdmin = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ message: 'Admin token required' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)

    if (payload.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' })
    }

    next()
  } catch {
    res.status(401).json({ message: 'Admin session invalid hai' })
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    message: 'MERN API is running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'offline',
  })
})

app.get('/api/users', async (_req, res) => {
  const users = await User.find()
    .sort({ createdAt: -1 })
    .select('name email createdAt')

  res.json(users.map(toSafeUser))
})

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password required' })
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: 'Password minimum 6 characters ka hona chahiye' })
  }

  const existingUser = await User.findOne({ email })

  if (existingUser) {
    return res.status(409).json({ message: 'Email already registered hai' })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    lastLoginAt: new Date(),
    loginCount: 1,
  })

  await LoginLog.create({
    user: user._id,
    name: user.name,
    email: user.email,
    action: 'register',
  })

  res.status(201).json({
    message: 'Account create ho gaya',
    token: createUserToken(user._id),
    user: toSafeUser(user),
  })
})

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' })
  }

  const user = await User.findOne({ email }).select('+password')

  if (!user) {
    return res.status(401).json({ message: 'Invalid email ya password' })
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)

  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid email ya password' })
  }

  user.lastLoginAt = new Date()
  user.loginCount += 1
  await user.save()

  await LoginLog.create({
    user: user._id,
    name: user.name,
    email: user.email,
    action: 'login',
  })

  res.json({
    message: 'Login successful',
    token: createUserToken(user._id),
    user: toSafeUser(user),
  })
})

app.post('/api/admin/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')

  if (email !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Admin email ya password galat hai' })
  }

  res.json({
    message: 'Admin login successful',
    token: createAdminToken(),
    admin: {
      email: ADMIN_EMAIL,
    },
  })
})

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  const users = await User.find()
    .sort({ createdAt: -1 })
    .select('name email createdAt lastLoginAt loginCount')

  res.json(users.map(toSafeUser))
})

app.get('/api/admin/logins', requireAdmin, async (_req, res) => {
  const logs = await LoginLog.find()
    .sort({ createdAt: -1 })
    .limit(30)
    .select('name email action createdAt')

  res.json(
    logs.map((log) => ({
      id: log._id,
      name: log.name,
      email: log.email,
      action: log.action,
      loggedAt: log.createdAt,
    })),
  )
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: 'Server error, thoda baad try karo' })
})

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API running on http://127.0.0.1:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })
