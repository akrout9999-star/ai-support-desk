const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, 'support-desk.db')

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')
db.pragma('synchronous = NORMAL')

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer'
      CHECK (role IN ('customer', 'agent')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run()

db.prepare(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL
  )
`).run()

const columns = db
  .prepare('PRAGMA table_info(tickets)')
  .all()
  .map((column) => column.name)

const requiredColumns = [
  ['customer_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL'],
  ['category', 'TEXT'],
  ['priority', 'TEXT'],
  ['ai_summary', 'TEXT'],
  ['suggested_reply', 'TEXT'],
  ['reply_status', "TEXT DEFAULT 'Draft'"],
]

for (const [name, definition] of requiredColumns) {
  if (!columns.includes(name)) {
    db.prepare(`ALTER TABLE tickets ADD COLUMN ${name} ${definition}`).run()
  }
}

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_tickets_customer_id
  ON tickets(customer_id)
`).run()

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_tickets_status
  ON tickets(status)
`).run()

module.exports = db
