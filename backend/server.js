require('dotenv').config()

const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const db = require('./database/db')
const authRoutes = require('./routes/auth')
const ticketRoutes = require('./routes/tickets')

const app = express()
const PORT = Number(process.env.PORT) || 5000

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET is missing or too short. Use at least 32 characters.')
  process.exit(1)
}

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)

app.disable('x-powered-by')

app.use(cors({
  origin(origin, callback) {
    const normalizedOrigin = origin?.replace(/\/$/, '')
    if (!origin || allowedOrigins.includes(normalizedOrigin)) return callback(null, true)
    return callback(new Error('Origin not allowed by CORS'))
  },
}))

app.use(express.json({ limit: '1mb' }))

async function ensureAgentAccount() {
  const name = process.env.AGENT_NAME?.trim() || 'Support Agent'
  const email = process.env.AGENT_EMAIL?.trim().toLowerCase()
  const password = process.env.AGENT_PASSWORD || ''

  if (!email || !password) {
    console.warn('Agent account not seeded. Set AGENT_EMAIL and AGENT_PASSWORD in .env.')
    return
  }

  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('AGENT_PASSWORD must be 8 to 72 bytes long.')
  }

  const existingResult = await db.query(
    'SELECT id, name, password_hash, role FROM users WHERE email = $1',
    [email],
  )
  const existing = existingResult.rows[0]

  const passwordMatches = existing
    ? await bcrypt.compare(password, existing.password_hash)
    : false

  if (existing && existing.name === name && existing.role === 'agent' && passwordMatches) {
    console.log(`Agent account ready: ${email}`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await db.query(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ($1, $2, $3, 'agent')
    ON CONFLICT(email) DO UPDATE SET
      name = EXCLUDED.name,
      password_hash = EXCLUDED.password_hash,
      role = 'agent'
  `, [name, email, passwordHash])

  console.log(`Agent account ready: ${email}`)
}

app.get('/', (req, res) => res.json({ message: 'SUPPORT/OS API is running' }))
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRoutes)
app.use('/api/tickets', ticketRoutes)

app.use((req, res) => res.status(404).json({ message: 'Route not found' }))

app.use((error, req, res, next) => {
  if (error.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed' })
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Invalid JSON body' })
  }
  console.error(error)
  return res.status(500).json({ message: 'Internal server error' })
})

async function start() {
  try {
    await db.initializeDatabase()
    await ensureAgentAccount()

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start SUPPORT/OS:', error.message || error)
    process.exit(1)
  }
}

start()
