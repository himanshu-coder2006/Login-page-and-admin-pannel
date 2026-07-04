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

const toLocalDateKey = (dateValue) => {
  const date = new Date(dateValue)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const createSevenDayBuckets = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_item, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))

    return {
      date: toLocalDateKey(date),
      label: date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      }),
      logins: 0,
      registrations: 0,
      total: 0,
    }
  })
}

const addLogToBuckets = (buckets, log) => {
  const key = toLocalDateKey(log.createdAt)
  const bucket = buckets.find((item) => item.date === key)

  if (!bucket) {
    return
  }

  if (log.action === 'register') {
    bucket.registrations += 1
  } else {
    bucket.logins += 1
  }

  bucket.total += 1
}

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

const updateLocalLoginIdentity = ({ email, name, previousEmail }) => {
  localLoginLogs.forEach((log) => {
    if (log.email === previousEmail) {
      log.email = email
      log.name = name
    }
  })
}

const deleteLocalLoginLogs = (email) => {
  for (let index = localLoginLogs.length - 1; index >= 0; index -= 1) {
    if (localLoginLogs[index].email === email) {
      localLoginLogs.splice(index, 1)
    }
  }
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

app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const name = String(req.body.name || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()

  if (!name || !email) {
    return res.status(400).json({ message: 'Name aur email required hain' })
  }

  if (name.length < 2) {
    return res.status(400).json({ message: 'Name minimum 2 characters ka hona chahiye' })
  }

  if (!(await canUseDatabase())) {
    const userIndex = localUsers.findIndex((user) => user._id === req.params.id)

    if (userIndex === -1) {
      return res.status(404).json({ message: 'User nahi mila' })
    }

    const duplicateEmail = localUsers.some(
      (user) => user.email === email && user._id !== req.params.id,
    )

    if (duplicateEmail) {
      return res.status(409).json({ message: 'Email already registered hai' })
    }

    const previousEmail = localUsers[userIndex].email
    localUsers[userIndex].name = name
    localUsers[userIndex].email = email
    updateLocalLoginIdentity({ email, name, previousEmail })
    saveLocalStore()

    return res.json({
      message: 'User update ho gaya',
      user: toSafeUser(localUsers[userIndex]),
    })
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'User nahi mila' })
  }

  const duplicateUser = await User.findOne({
    email,
    _id: { $ne: req.params.id },
  })

  if (duplicateUser) {
    return res.status(409).json({ message: 'Email already registered hai' })
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { email, name },
    { new: true, runValidators: true },
  ).select('name email createdAt lastLoginAt loginCount')

  if (!user) {
    return res.status(404).json({ message: 'User nahi mila' })
  }

  await LoginLog.updateMany({ user: user._id }, { email: user.email, name: user.name })

  res.json({
    message: 'User update ho gaya',
    user: toSafeUser(user),
  })
})

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  if (!(await canUseDatabase())) {
    const userIndex = localUsers.findIndex((user) => user._id === req.params.id)

    if (userIndex === -1) {
      return res.status(404).json({ message: 'User nahi mila' })
    }

    const [deletedUser] = localUsers.splice(userIndex, 1)
    deleteLocalLoginLogs(deletedUser.email)
    saveLocalStore()

    return res.json({ message: 'User delete ho gaya' })
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'User nahi mila' })
  }

  const user = await User.findByIdAndDelete(req.params.id)

  if (!user) {
    return res.status(404).json({ message: 'User nahi mila' })
  }

  await LoginLog.deleteMany({ user: user._id })

  res.json({ message: 'User delete ho gaya' })
})

app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const weekStart = new Date(todayStart)
  weekStart.setDate(todayStart.getDate() - 6)

  if (!(await canUseDatabase())) {
    const activityByDay = createSevenDayBuckets()
    const recentLogs = localLoginLogs.filter((log) => log.createdAt >= weekStart)

    recentLogs.forEach((log) => addLogToBuckets(activityByDay, log))

    const recentRegistrations = sortNewestFirst(localUsers)
      .slice(0, 5)
      .map(toSafeUser)

    const topUsers = [...localUsers]
      .sort((first, second) => second.loginCount - first.loginCount)
      .slice(0, 5)
      .map(toSafeUser)

    res.json({
      database: 'local-file',
      users: {
        total: localUsers.length,
        activeToday: localUsers.filter((user) => user.lastLoginAt >= todayStart)
          .length,
        newThisWeek: localUsers.filter((user) => user.createdAt >= weekStart)
          .length,
        inactive: localUsers.filter((user) => !user.lastLoginAt).length,
      },
      logins: {
        total: localLoginLogs.length,
        last7Days: recentLogs.length,
      },
      recentRegistrations,
      topUsers,
      activityByDay,
    })
    return
  }

  const [
    totalUsers,
    activeToday,
    newThisWeek,
    inactive,
    totalLogs,
    recentLogs,
    recentRegistrations,
    topUsers,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastLoginAt: { $gte: todayStart } }),
    User.countDocuments({ createdAt: { $gte: weekStart } }),
    User.countDocuments({ lastLoginAt: null }),
    LoginLog.countDocuments(),
    LoginLog.find({ createdAt: { $gte: weekStart } }).select('action createdAt'),
    User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email createdAt lastLoginAt loginCount'),
    User.find()
      .sort({ loginCount: -1, lastLoginAt: -1 })
      .limit(5)
      .select('name email createdAt lastLoginAt loginCount'),
  ])

  const activityByDay = createSevenDayBuckets()
  recentLogs.forEach((log) => addLogToBuckets(activityByDay, log))

  res.json({
    database: 'connected',
    users: {
      total: totalUsers,
      activeToday,
      newThisWeek,
      inactive,
    },
    logins: {
      total: totalLogs,
      last7Days: recentLogs.length,
    },
    recentRegistrations: recentRegistrations.map(toSafeUser),
    topUsers: topUsers.map(toSafeUser),
    activityByDay,
  })
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
