const jwt = require('jsonwebtoken')
const db = require('../database/db')

async function authenticate(req, res, next) {
  const authorization = req.headers.authorization || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'support-os',
    })

    const result = await db.query(`
      SELECT id, name, email, role, created_at
      FROM users
      WHERE id = $1
    `, [payload.sub])

    const user = result.rows[0]

    if (!user) {
      return res.status(401).json({ message: 'Your account no longer exists' })
    }

    req.user = user
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' })
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action',
      })
    }
    return next()
  }
}

module.exports = { authenticate, requireRole }
