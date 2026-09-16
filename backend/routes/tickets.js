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

function getAgentTicket(id) {
  return db
    .prepare(`
      SELECT
        tickets.*,
        users.name AS customer_name,
        users.email AS customer_email
      FROM tickets
      LEFT JOIN users
        ON users.id = tickets.customer_id
      WHERE tickets.id = ?
    `)
    .get(id)
}

function getTicketForUser(id, user) {
  if (user.role === 'agent') {
    return getAgentTicket(id)
  }

  return db
    .prepare(`
      SELECT *
      FROM tickets
      WHERE id = ? AND customer_id = ?
    `)
    .get(id, user.id)
}

function customerTicket(ticket) {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    created_at: ticket.created_at,
    agent_reply: ticket.reply_status === 'Approved'
      ? ticket.suggested_reply
      : null,
  }
}

function visibleTicket(ticket, user) {
  if (!ticket) return null
  return user.role === 'agent' ? ticket : customerTicket(ticket)
}

function requireValidTicketId(req, res) {
  const id = parseTicketId(req.params.id)

  if (!id) {
    res.status(400).json({
      message: 'Invalid ticket ID',
    })
    return null
  }

  return id
}

router.get('/', (req, res) => {
  if (req.user.role === 'agent') {
    const tickets = db
      .prepare(`
        SELECT
          tickets.*,
          users.name AS customer_name,
          users.email AS customer_email
        FROM tickets
        LEFT JOIN users
          ON users.id = tickets.customer_id
        ORDER BY tickets.id DESC
      `)
      .all()

    return res.json({ tickets })
  }

  const tickets = db
    .prepare(`
      SELECT *
      FROM tickets
      WHERE customer_id = ?
      ORDER BY id DESC
    `)
    .all(req.user.id)
    .map(customerTicket)

  return res.json({ tickets })
})

router.get('/:id', (req, res) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined

  const ticket = getTicketForUser(id, req.user)

  if (!ticket) {
    return res.status(404).json({
      message: 'Ticket not found',
    })
  }

  return res.json({
    ticket: visibleTicket(ticket, req.user),
  })
})

router.post('/', requireRole('customer'), (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
  const description = typeof req.body.description === 'string'
    ? req.body.description.trim()
    : ''

  if (!title || !description) {
    return res.status(400).json({
      message: 'Title and description are required',
    })
  }

  if (title.length > 160) {
    return res.status(400).json({
      message: 'Title must be 160 characters or fewer',
    })
  }

  if (description.length > 5000) {
    return res.status(400).json({
      message: 'Description must be 5000 characters or fewer',
    })
  }

  const result = db
    .prepare(`
      INSERT INTO tickets (customer_id, title, description)
      VALUES (?, ?, ?)
    `)
    .run(req.user.id, title, description)

  const ticket = db
    .prepare('SELECT * FROM tickets WHERE id = ?')
    .get(result.lastInsertRowid)

  return res.status(201).json({
    message: 'Ticket created successfully',
    ticket: customerTicket(ticket),
  })
})

router.post('/:id/analyze', requireRole('agent'), async (req, res) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined

  try {
    const ticket = getAgentTicket(id)

    if (!ticket) {
      return res.status(404).json({
        message: 'Ticket not found',
      })
    }

    const analysis = await analyzeTicket(ticket.title, ticket.description)

    db.prepare(`
      UPDATE tickets
      SET
        category = ?,
        priority = ?,
        ai_summary = ?,
        suggested_reply = ?,
        reply_status = 'Draft'
      WHERE id = ?
    `).run(
      analysis.category,
      analysis.priority,
      analysis.summary,
      analysis.suggestedReply,
      id,
    )

    return res.json({
      message: 'Ticket analyzed successfully',
      ticket: getAgentTicket(id),
    })
  } catch (error) {
    console.error('AI analysis failed:', error.message || error)

    const status = Number(error.status || error.code)
    if (status === 503 || status === 429) {
      return res.status(503).json({
        message: 'AI service is temporarily unavailable. Please try again shortly.',
      })
    }

    return res.status(500).json({
      message: 'AI analysis failed',
    })
  }
})

router.patch('/:id/status', requireRole('agent'), (req, res) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined

  const allowedStatuses = ['Open', 'In Progress', 'Resolved']
  const { status } = req.body

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: 'Invalid ticket status',
    })
  }

  const result = db
    .prepare('UPDATE tickets SET status = ? WHERE id = ?')
    .run(status, id)

  if (result.changes === 0) {
    return res.status(404).json({
      message: 'Ticket not found',
    })
  }

  return res.json({
    message: 'Ticket status updated successfully',
    ticket: getAgentTicket(id),
  })
})

router.patch('/:id/reply', requireRole('agent'), (req, res) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined

  const suggestedReply = typeof req.body.suggestedReply === 'string'
    ? req.body.suggestedReply.trim()
    : ''

  if (!suggestedReply) {
    return res.status(400).json({
      message: 'Reply cannot be empty',
    })
  }

  if (suggestedReply.length > 10000) {
    return res.status(400).json({
      message: 'Reply must be 10000 characters or fewer',
    })
  }

  const result = db
    .prepare(`
      UPDATE tickets
      SET suggested_reply = ?, reply_status = 'Draft'
      WHERE id = ?
    `)
    .run(suggestedReply, id)

  if (result.changes === 0) {
    return res.status(404).json({
      message: 'Ticket not found',
    })
  }

  return res.json({
    message: 'Reply draft saved',
    ticket: getAgentTicket(id),
  })
})

router.patch('/:id/reply/approve', requireRole('agent'), (req, res) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined

  const ticket = getAgentTicket(id)

  if (!ticket) {
    return res.status(404).json({
      message: 'Ticket not found',
    })
  }

  if (!ticket.suggested_reply?.trim()) {
    return res.status(400).json({
      message: 'A reply must exist before approval',
    })
  }

  db.prepare(`
    UPDATE tickets
    SET reply_status = 'Approved'
    WHERE id = ?
  `).run(id)

  return res.json({
    message: 'Reply approved',
    ticket: getAgentTicket(id),
  })
})

router.delete('/:id', requireRole('agent'), (req, res) => {
  const id = requireValidTicketId(req, res)
  if (!id) return undefined

  const result = db
    .prepare('DELETE FROM tickets WHERE id = ?')
    .run(id)

  if (result.changes === 0) {
    return res.status(404).json({
      message: 'Ticket not found',
    })
  }

  return res.json({
    message: 'Ticket deleted successfully',
  })
})

module.exports = router
