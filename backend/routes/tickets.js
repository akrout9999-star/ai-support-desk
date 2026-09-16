const express = require('express')
const db = require('../database/db')
const { analyzeTicket } = require('../services/aiService')
const { authenticate, requireRole } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate)

function parseTicketId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

async function getAgentTicket(id) {
  const result = await db.query(`
    SELECT tickets.*, users.name AS customer_name, users.email AS customer_email
    FROM tickets
    LEFT JOIN users ON users.id = tickets.customer_id
    WHERE tickets.id = $1
  `, [id])
  return result.rows[0]
}

async function getTicketForUser(id, user) {
  if (user.role === 'agent') return getAgentTicket(id)
  const result = await db.query(
    'SELECT * FROM tickets WHERE id = $1 AND customer_id = $2',
    [id, user.id],
  )
  return result.rows[0]
}

function customerTicket(ticket) {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    created_at: ticket.created_at,
    agent_reply: ticket.reply_status === 'Approved' ? ticket.suggested_reply : null,
  }
}

function visibleTicket(ticket, user) {
  if (!ticket) return null
  return user.role === 'agent' ? ticket : customerTicket(ticket)
}

function requireValidTicketId(req, res) {
  const id = parseTicketId(req.params.id)
  if (!id) {
    res.status(400).json({ message: 'Invalid ticket ID' })
    return null
  }
  return id
}

router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'agent') {
      const result = await db.query(`
        SELECT tickets.*, users.name AS customer_name, users.email AS customer_email
        FROM tickets
        LEFT JOIN users ON users.id = tickets.customer_id
        ORDER BY tickets.id DESC
      `)
      return res.json({ tickets: result.rows })
    }

    const result = await db.query(
      'SELECT * FROM tickets WHERE customer_id = $1 ORDER BY id DESC',
      [req.user.id],
    )
    return res.json({ tickets: result.rows.map(customerTicket) })
  } catch (error) {
    return next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined

  try {
    const ticket = await getTicketForUser(id, req.user)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
    return res.json({ ticket: visibleTicket(ticket, req.user) })
  } catch (error) {
    return next(error)
  }
})

router.post('/', requireRole('customer'), async (req, res, next) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : ''

  if (!title || !description) {
    return res.status(400).json({ message: 'Title and description are required' })
  }
  if (title.length > 160) {
    return res.status(400).json({ message: 'Title must be 160 characters or fewer' })
  }
  if (description.length > 5000) {
    return res.status(400).json({ message: 'Description must be 5000 characters or fewer' })
  }

  try {
    const result = await db.query(`
      INSERT INTO tickets (customer_id, title, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.user.id, title, description])

    return res.status(201).json({
      message: 'Ticket created successfully',
      ticket: customerTicket(result.rows[0]),
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/:id/analyze', requireRole('agent'), async (req, res) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined

  try {
    const ticket = await getAgentTicket(id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })

    const analysis = await analyzeTicket(ticket.title, ticket.description)

    await db.query(`
      UPDATE tickets
      SET category = $1, priority = $2, ai_summary = $3,
          suggested_reply = $4, reply_status = 'Draft'
      WHERE id = $5
    `, [analysis.category, analysis.priority, analysis.summary, analysis.suggestedReply, id])

    return res.json({
      message: 'Ticket analyzed successfully',
      ticket: await getAgentTicket(id),
    })
  } catch (error) {
    console.error('AI analysis failed:', error.message || error)
    const status = Number(error.status || error.code)
    if (status === 503 || status === 429) {
      return res.status(503).json({
        message: 'AI service is temporarily unavailable. Please try again shortly.',
      })
    }
    return res.status(500).json({ message: 'AI analysis failed' })
  }
})

router.patch('/:id/status', requireRole('agent'), async (req, res, next) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined
  const allowedStatuses = ['Open', 'In Progress', 'Resolved']
  const { status } = req.body

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid ticket status' })
  }

  try {
    const result = await db.query(
      'UPDATE tickets SET status = $1 WHERE id = $2 RETURNING id',
      [status, id],
    )
    if (!result.rowCount) return res.status(404).json({ message: 'Ticket not found' })
    return res.json({
      message: 'Ticket status updated successfully',
      ticket: await getAgentTicket(id),
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/:id/reply', requireRole('agent'), async (req, res, next) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined

  const suggestedReply = typeof req.body.suggestedReply === 'string'
    ? req.body.suggestedReply.trim()
    : ''

  if (!suggestedReply) return res.status(400).json({ message: 'Reply cannot be empty' })
  if (suggestedReply.length > 10000) {
    return res.status(400).json({ message: 'Reply must be 10000 characters or fewer' })
  }

  try {
    const result = await db.query(`
      UPDATE tickets
      SET suggested_reply = $1, reply_status = 'Draft'
      WHERE id = $2
      RETURNING id
    `, [suggestedReply, id])

    if (!result.rowCount) return res.status(404).json({ message: 'Ticket not found' })
    return res.json({
      message: 'Reply draft saved',
      ticket: await getAgentTicket(id),
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/:id/reply/approve', requireRole('agent'), async (req, res, next) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined

  try {
    const ticket = await getAgentTicket(id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })
    if (!ticket.suggested_reply?.trim()) {
      return res.status(400).json({ message: 'A reply must exist before approval' })
    }

    await db.query("UPDATE tickets SET reply_status = 'Approved' WHERE id = $1", [id])
    return res.json({
      message: 'Reply approved',
      ticket: await getAgentTicket(id),
    })
  } catch (error) {
    return next(error)
  }
})

router.delete('/:id', requireRole('agent'), async (req, res, next) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined

  try {
    const result = await db.query('DELETE FROM tickets WHERE id = $1 RETURNING id', [id])
    if (!result.rowCount) return res.status(404).json({ message: 'Ticket not found' })
    return res.json({ message: 'Ticket deleted successfully' })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
