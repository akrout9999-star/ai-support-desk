const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../database/db')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

const normalizeEmail = (email) => (
  typeof email === 'string' ? email.trim().toLowerCase() : ''
)

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  created_at: user.created_at,
})

function createToken(user) {
  return jwt.sign(
    {},
    process.env.JWT_SECRET,
    {
      subject: String(user.id),
      expiresIn: '7d',
      issuer: 'support-os',
      algorithm: 'HS256',
    },
  )
}

router.post('/register', async (req, res, next) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
  const email = normalizeEmail(req.body.email)
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  const passwordBytes = Buffer.byteLength(password, 'utf8')

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({
      message: 'Name must be between 2 and 80 characters',
    })
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      message: 'Enter a valid email address',
    })
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters',
    })
  }

  if (passwordBytes > 72) {
    return res.status(400).json({
      message: 'Password is too long',
    })
  }

  const existingUser = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email)

  if (existingUser) {
    return res.status(409).json({
      message: 'An account with this email already exists',
    })
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const result = db
      .prepare(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, 'customer')
      `)
      .run(name, email, passwordHash)

    const user = db
      .prepare(`
        SELECT id, name, email, role, created_at
        FROM users
        WHERE id = ?
      `)
      .get(result.lastInsertRowid)

    return res.status(201).json({
      message: 'Account created successfully',
      token: createToken(user),
      user: publicUser(user),
    })
  } catch (error) {
    if (String(error.code || '').startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({
        message: 'An account with this email already exists',
      })
    }
    return next(error)
  }
})

router.post('/login', async (req, res, next) => {
  const email = normalizeEmail(req.body.email)
  const password = typeof req.body.password === 'string' ? req.body.password : ''

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required',
    })
  }

  if (email.length > 254 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(401).json({
      message: 'Invalid email or password',
    })
  }

  try {
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email)

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        message: 'Invalid email or password',
      })
    }

    return res.json({
      message: 'Login successful',
      token: createToken(user),
      user: publicUser(user),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/me', authenticate, (req, res) => {
  res.json({
    user: publicUser(req.user),
  })
})

module.exports = router
