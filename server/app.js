import bcrypt from 'bcryptjs'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

dotenv.config()

const app = express()
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mern-login-app'
const MONGODB_TIMEOUT_MS = Number(process.env.MONGODB_TIMEOUT_MS || 10000)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'hp807655@gmail.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const LOCAL_STORE_PATH =
  process.env.LOCAL_STORE_PATH || path.join(process.cwd(), '.data', 'local-store.json')

let mongoConnectionPromise = null
let useLocalStore = false
const localUsers = []
const localLoginLogs = []

const toDate = (value) => (value ? new Date(value) : null)

const loadLocalStore = () => {
  try {
    if (!fs.existsSync(LOCAL_STORE_PATH)) {
      return
    }

    const store = JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, 'utf8'))

    localUsers.push(
      ...(store.users || []).map((user) => ({
        ...user,
        createdAt: toDate(user.createdAt) || new Date(),
        lastLoginAt: toDate(user.lastLoginAt),
      })),
    )

    localLoginLogs.push(
      ...(store.loginLogs || []).map((log) => ({
        ...log,
        createdAt: toDate(log.createdAt) || new Date(),
      })),
    )
  } catch (error) {
    console.error('Local store load failed:', error.message)
  }
}

const saveLocalStore = () => {
  try {
    fs.mkdirSync(path.dirname(LOCAL_STORE_PATH), { recursive: true })
    fs.writeFileSync(
      LOCAL_STORE_PATH,
      JSON.stringify(
        {
          users: localUsers,
          loginLogs: localLoginLogs,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    console.error('Local store save failed:', error.message)
  }
}

loadLocalStore()

export const connectDatabase = () => {
  if (useLocalStore) {
    return Promise.reject(new Error('Using local memory store'))
  }

  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection)
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose
      .connect(MONGODB_URI, { serverSelectionTimeoutMS: MONGODB_TIMEOUT_MS })
      .catch((error) => {
        mongoConnectionPromise = null
        useLocalStore = true
        throw error
      })
  }

  return mongoConnectionPromise
}

app.use(cors())
app.use(express.json())

const canUseDatabase = async () => {
  try {
    await connectDatabase()
    return true
  } catch {
    return false
  }
}

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

const User = mongoose.models.User || mongoose.model('User', userSchema)

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

const LoginLog =
  mongoose.models.LoginLog || mongoose.model('LoginLog', loginLogSchema)

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

const sortNewestFirst = (items) =>
  [...items].sort((first, second) => second.createdAt - first.createdAt)

const createLocalLoginLog = ({ user, action }) => {
  localLoginLogs.unshift({
    _id: crypto.randomUUID(),
    name: user.name,
    email: user.email,
    action,
    createdAt: new Date(),
  })

  saveLocalStore()
}

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

app.get('/', (_req, res) => {
  res.json({ message: 'Backend API is running' })
})

app.get('/api/health', async (_req, res) => {
  const databaseConnected = await canUseDatabase()

  res.json({
    message: 'MERN API is running',
    database: databaseConnected ? 'connected' : 'local-file',
  })
})

app.get('/api/users', async (_req, res) => {
  if (!(await canUseDatabase())) {
    res.json(sortNewestFirst(localUsers).map(toSafeUser))
    return
  }

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

  if (!(await canUseDatabase())) {
    const existingLocalUser = localUsers.find((user) => user.email === email)

    if (existingLocalUser) {
      return res.status(409).json({ message: 'Email already registered hai' })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = {
      _id: crypto.randomUUID(),
      name,
      email,
      password: hashedPassword,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      loginCount: 1,
    }

    localUsers.push(user)
    createLocalLoginLog({ user, action: 'register' })

    return res.status(201).json({
      message: 'Account create ho gaya',
      token: createUserToken(user._id),
      user: toSafeUser(user),
    })
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

  if (!(await canUseDatabase())) {
    const user = localUsers.find((localUser) => localUser.email === email)

    if (!user) {
      return res.status(401).json({ message: 'Invalid email ya password' })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email ya password' })
    }

    user.lastLoginAt = new Date()
    user.loginCount += 1
    createLocalLoginLog({ user, action: 'login' })

    return res.json({
      message: 'Login successful',
      token: createUserToken(user._id),
      user: toSafeUser(user),
    })
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
  if (!(await canUseDatabase())) {
    res.json(sortNewestFirst(localUsers).map(toSafeUser))
    return
  }

  const users = await User.find()
    .sort({ createdAt: -1 })
    .select('name email createdAt lastLoginAt loginCount')

  res.json(users.map(toSafeUser))
})

app.get('/api/admin/logins', requireAdmin, async (_req, res) => {
  if (!(await canUseDatabase())) {
    res.json(
      localLoginLogs.slice(0, 30).map((log) => ({
        id: log._id,
        name: log.name,
        email: log.email,
        action: log.action,
        loggedAt: log.createdAt,
      })),
    )
    return
  }

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
  if (err.name === 'MongooseServerSelectionError') {
    res.status(503).json({
      message:
        'Database connect nahi ho rahi. MongoDB start karo ya MONGODB_URI check karo.',
    })
    return
  }

  res.status(500).json({ message: 'Server error, thoda baad try karo' })
})

export default app
