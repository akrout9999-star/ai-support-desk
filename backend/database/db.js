const { Pool } = require('pg')

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function query(text, params = []) {
  return pool.query(text, params)
}

async function initializeDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer'
        CHECK (role IN ('customer', 'agent')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      category TEXT,
      priority TEXT,
      ai_summary TEXT,
      suggested_reply TEXT,
      reply_status TEXT NOT NULL DEFAULT 'Draft'
    )
  `)

  await query(`CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON tickets(customer_id)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`)
}

module.exports = { query, initializeDatabase }
