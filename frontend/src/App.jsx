import { useCallback, useEffect, useMemo, useState } from 'react'

const API_BASE = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/$/, '')

const AUTH_KEY = 'supportos_session'

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function api(path, options = {}, token = '') {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new ApiError(
        data.message || 'Something went wrong',
        response.status,
      )
    }

    return data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(
      'Unable to reach the server. It may be waking up — please try again in a moment.',
      0,
    )
  }
}

const ticketId = (id) => `T-${String(id).padStart(4, '0')}`

function Status({ value = 'Open' }) {
  const slug = String(value).toLowerCase().replaceAll(' ', '-')
  return <span className={`status status-${slug}`}>{value}</span>
}

function Notice({ children, onClose }) {
  useEffect(() => {
    if (!children) return undefined

    const timer = window.setTimeout(() => {
      onClose?.()
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [children, onClose])

  if (!children) return null

  return (
    <div className="notice" role="status">
      <span>{children}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss message"
      >
        ×
      </button>
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      Built by <strong>Asish</strong> · © 2026
    </footer>
  )
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register'
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : form
      const data = await api(path, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      onAuthenticated(data)
    } catch (err) {
      setError(err.message || 'Unable to continue')
    } finally {
      setBusy(false)
    }
  }

  const switchMode = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'))
    setError('')
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span>SUPPORT/OS</span>
        </div>

        <div className="showcase-copy">
          <span className="eyebrow">AI SUPPORT OPERATIONS</span>
          <h1>Support that moves at the speed of your customers.</h1>
          <p>
            One workspace for customer requests, AI-assisted triage,
            human-reviewed responses and resolution.
          </p>
          <div className="feature-row">
            <div><strong>01</strong><span>Customer-first ticketing</span></div>
            <div><strong>02</strong><span>Gemini-powered diagnostics</span></div>
            <div><strong>03</strong><span>Human approval built in</span></div>
          </div>
        </div>

        <div className="showcase-orb" />
      </section>

      <section className="auth-side">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-mobile-brand">SUPPORT/OS</div>
          <span className="eyebrow">
            {mode === 'login' ? 'WELCOME BACK' : 'CUSTOMER ACCESS'}
          </span>
          <h2>
            {mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}
          </h2>
          <p>
            {mode === 'login'
              ? 'Customers and support agents use the same secure entry point.'
              : 'Create an account to raise and track support requests.'}
          </p>

          {mode === 'register' && (
            <label>
              Full name
              <input
                required
                maxLength="80"
                autoComplete="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Your name"
              />
            </label>
          )}

          <label>
            Email address
            <input
              required
              type="email"
              maxLength="254"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              required
              type="password"
              minLength="8"
              maxLength="72"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="At least 8 characters"
            />
          </label>

          {error && <div className="error-box" role="alert">{error}</div>}

          <button className="primary wide" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <div className="auth-switch">
            {mode === 'login' ? 'New customer?' : 'Already have an account?'}
            <button type="button" onClick={switchMode}>
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </form>
        <SiteFooter />
      </section>
    </main>
  )
}

function Shell({ user, onLogout, children }) {
  const roleTheme = user.role === 'agent' ? 'theme-agent' : 'theme-customer'

  return (
    <div className={`app-shell ${roleTheme}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span>SUPPORT/OS</span>
        </div>

        <div className="topbar-right">
          {user.role === 'agent' && (
            <div className="ai-state-wrap">
              <span className="online-dot" />
              <span className="ai-state">AI Enabled</span>
            </div>
          )}

          <div className="identity">
            <span className="avatar">{user.name?.[0]?.toUpperCase() || '?'}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.role === 'agent' ? 'Support Agent' : 'Customer'}</span>
            </div>
          </div>

          <button type="button" className="ghost" onClick={onLogout}>Sign out</button>
        </div>
      </header>
      {children}
      <SiteFooter />
    </div>
  )
}

function CustomerPortal({ session, onLogout }) {
  const { token, user } = session
  const [tickets, setTickets] = useState([])
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')

  const handleApiError = useCallback((err) => {
    if (err.status === 401) {
      onLogout()
      return
    }
    setNotice(err.message || 'Unable to load your requests')
  }, [onLogout])

  const loadTickets = useCallback(async (preferredId = null) => {
    try {
      const data = await api('/tickets', {}, token)
      const nextTickets = Array.isArray(data.tickets) ? data.tickets : []
      setTickets(nextTickets)
      setSelected((current) => {
        const targetId = preferredId ?? current?.id
        return nextTickets.find((ticket) => ticket.id === targetId)
          || nextTickets[0]
          || null
      })
    } catch (err) {
      handleApiError(err)
    } finally {
      setLoading(false)
    }
  }, [handleApiError, token])

  useEffect(() => {
    const timer = window.setTimeout(loadTickets, 0)
    return () => window.clearTimeout(timer)
  }, [loadTickets])

  const createTicket = async (event) => {
    event.preventDefault()
    setBusy(true)
    setNotice('')

    try {
      const data = await api('/tickets', {
        method: 'POST',
        body: JSON.stringify(form),
      }, token)

      setForm({ title: '', description: '' })
      setCreating(false)
      setNotice('Ticket submitted successfully.')
      await loadTickets(data.ticket.id)
    } catch (err) {
      handleApiError(err)
    } finally {
      setBusy(false)
    }
  }

  const counts = useMemo(() => ({
    total: tickets.length,
    active: tickets.filter((ticket) => ticket.status !== 'Resolved').length,
    resolved: tickets.filter((ticket) => ticket.status === 'Resolved').length,
  }), [tickets])

  return (
    <Shell user={user} onLogout={onLogout}>
      <div className="customer-layout">
        <nav className="workspace-strip customer-strip" aria-label="Customer workspace">
          <span className="workspace-title">CUSTOMER PORTAL</span>
          <span className="workspace-tab active" aria-current="page">My Tickets</span>
        </nav>

        <main className="customer-main">
          <div className="welcome-row">
            <div>
              <span className="eyebrow">CUSTOMER DASHBOARD</span>
              <h1>Good to see you, {user.name.split(' ')[0]}.</h1>
              <p>Track your requests and responses from the support team.</p>
            </div>
            <button type="button" className="primary" onClick={() => setCreating(true)}>
              ＋ New ticket
            </button>
          </div>

          <Notice onClose={() => setNotice('')}>{notice}</Notice>

          <div className="stats">
            <article><span>Total requests</span><strong>{counts.total}</strong></article>
            <article><span>Active</span><strong>{counts.active}</strong></article>
            <article><span>Resolved</span><strong>{counts.resolved}</strong></article>
          </div>

          <section className="customer-grid">
            <div className="ticket-list panel">
              <div className="panel-head">
                <div><span className="eyebrow">REQUESTS</span><h2>My tickets</h2></div>
                <span>{tickets.length} total</span>
              </div>

              {loading ? (
                <div className="empty compact-empty"><strong>Loading requests…</strong></div>
              ) : tickets.length === 0 ? (
                <div className="empty">
                  <strong>No support requests yet</strong>
                  <span>Create your first ticket when you need help.</span>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <button
                    type="button"
                    key={ticket.id}
                    className={`ticket-row ${selected?.id === ticket.id ? 'selected' : ''}`}
                    onClick={() => setSelected(ticket)}
                  >
                    <div><span className="mono">{ticketId(ticket.id)}</span><Status value={ticket.status} /></div>
                    <strong>{ticket.title}</strong>
                    <p>{ticket.description}</p>
                  </button>
                ))
              )}
            </div>

            <div className="ticket-detail panel">
              {selected ? (
                <>
                  <div className="panel-head detail-head">
                    <div><span className="mono">{ticketId(selected.id)}</span><h2>{selected.title}</h2></div>
                    <Status value={selected.status} />
                  </div>

                  <div className="message customer-message">
                    <span>YOUR REQUEST</span>
                    <p>{selected.description}</p>
                  </div>

                  <div className="progress-line" aria-label={`Ticket status: ${selected.status}`}>
                    <i className="done" /><span />
                    <i className={selected.status !== 'Open' ? 'done' : ''} /><span />
                    <i className={selected.status === 'Resolved' ? 'done' : ''} />
                  </div>
                  <div className="progress-labels">
                    <span>Submitted</span><span>In progress</span><span>Resolved</span>
                  </div>

                  {selected.agent_reply ? (
                    <div className="message agent-message">
                      <span>SUPPORT TEAM · APPROVED RESPONSE</span>
                      <p>{selected.agent_reply}</p>
                    </div>
                  ) : (
                    <div className="waiting">
                      <span>✦</span>
                      <div>
                        <strong>Support team is reviewing this request</strong>
                        <p>An approved response will appear here.</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty detail-empty">
                  <strong>Ticket details will appear here</strong>
                  <span>Create a request to start a support conversation.</span>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {creating && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (!busy && event.target === event.currentTarget) setCreating(false)
          }}
        >
          <form
            className="modal"
            onSubmit={createTicket}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-ticket-title"
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">NEW REQUEST</span>
                <h2 id="new-ticket-title">How can we help?</h2>
              </div>
              <button
                type="button"
                className="close"
                disabled={busy}
                onClick={() => setCreating(false)}
                aria-label="Close new ticket form"
              >×</button>
            </div>

            <label>
              Issue title
              <input
                required
                maxLength="160"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Briefly describe the issue"
              />
            </label>

            <label>
              Description
              <textarea
                required
                rows="7"
                maxLength="5000"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Tell the support team what happened…"
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="ghost" disabled={busy} onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit ticket'}
              </button>
            </div>
          </form>
        </div>
      )}
    </Shell>
  )
}

function AgentPortal({ session, onLogout }) {
  const { token, user } = session
  const [tickets, setTickets] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [notice, setNotice] = useState('')

  const handleApiError = useCallback((err) => {
    if (err.status === 401) {
      onLogout()
      return
    }
    setNotice(err.message || 'Something went wrong')
  }, [onLogout])

  const loadTickets = useCallback(async () => {
    try {
      const data = await api('/tickets', {}, token)
      const nextTickets = Array.isArray(data.tickets) ? data.tickets : []
      const firstTicket = nextTickets[0] || null
      setTickets(nextTickets)
      setSelectedId(firstTicket?.id ?? null)
      setReply(firstTicket?.suggested_reply || '')
    } catch (err) {
      handleApiError(err)
    } finally {
      setLoading(false)
    }
  }, [handleApiError, token])

  useEffect(() => {
    const timer = window.setTimeout(loadTickets, 0)
    return () => window.clearTimeout(timer)
  }, [loadTickets])

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) || null,
    [selectedId, tickets],
  )

  const replaceTicket = (nextTicket) => {
    setTickets((current) => current.map((ticket) => (
      ticket.id === nextTicket.id ? nextTicket : ticket
    )))
  }

  const mutateTicket = async (label, path, options) => {
    setBusy(label)
    setNotice('')

    try {
      const data = await api(path, options, token)
      if (data.ticket) replaceTicket(data.ticket)
      if (data.message) setNotice(data.message)
      return data
    } catch (err) {
      handleApiError(err)
      return null
    } finally {
      setBusy('')
    }
  }

  const selectTicket = (ticket) => {
    setSelectedId(ticket.id)
    setReply(ticket.suggested_reply || '')
    setNotice('')
  }

  const analyze = async () => {
    if (!selected) return

    const hasResponseToReplace = selected.reply_status === 'Approved'
      || reply !== (selected.suggested_reply || '')

    if (hasResponseToReplace && !window.confirm(
      'Re-running AI analysis will replace the current response with a new draft. Continue?',
    )) return

    const data = await mutateTicket(
      'analyze',
      `/tickets/${selected.id}/analyze`,
      { method: 'POST' },
    )

    if (data?.ticket) setReply(data.ticket.suggested_reply || '')
  }

  const changeStatus = (value) => {
    if (!selected) return
    mutateTicket('status', `/tickets/${selected.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: value }),
    })
  }

  const saveReply = async () => {
    if (!selected) return
    const data = await mutateTicket('save', `/tickets/${selected.id}/reply`, {
      method: 'PATCH',
      body: JSON.stringify({ suggestedReply: reply }),
    })
    if (data?.ticket) setReply(data.ticket.suggested_reply || '')
  }

  const approve = async () => {
    if (!selected || !reply.trim()) return

    setBusy('approve')
    setNotice('')

    try {
      let currentTicket = selected
      const dirty = reply !== (selected.suggested_reply || '')

      if (dirty) {
        const saved = await api(`/tickets/${selected.id}/reply`, {
          method: 'PATCH',
          body: JSON.stringify({ suggestedReply: reply }),
        }, token)
        currentTicket = saved.ticket
        replaceTicket(saved.ticket)
      }

      const approved = await api(`/tickets/${currentTicket.id}/reply/approve`, {
        method: 'PATCH',
      }, token)

      replaceTicket(approved.ticket)
      setReply(approved.ticket.suggested_reply || '')
      setNotice(approved.message || 'Reply approved')
    } catch (err) {
      handleApiError(err)
    } finally {
      setBusy('')
    }
  }

  const remove = async () => {
    if (!selected) return
    if (!window.confirm(`Delete ${ticketId(selected.id)}? This cannot be undone.`)) return

    setBusy('delete')
    setNotice('')

    try {
      await api(`/tickets/${selected.id}`, { method: 'DELETE' }, token)
      const remaining = tickets.filter((ticket) => ticket.id !== selected.id)
      const nextTicket = remaining[0] || null
      setTickets(remaining)
      setSelectedId(nextTicket?.id ?? null)
      setReply(nextTicket?.suggested_reply || '')
      setNotice('Ticket deleted successfully.')
    } catch (err) {
      handleApiError(err)
    } finally {
      setBusy('')
    }
  }

  const visible = useMemo(() => tickets.filter((ticket) => {
    const matchesFilter = filter === 'All' || ticket.status === filter
    const query = search.trim().toLowerCase()
    const haystack = `${ticket.id} ${ticket.title} ${ticket.description} ${ticket.customer_name || ''} ${ticket.customer_email || ''}`.toLowerCase()
    return matchesFilter && (!query || haystack.includes(query))
  }), [filter, search, tickets])

  const activeCount = useMemo(
    () => tickets.filter((ticket) => ticket.status !== 'Resolved').length,
    [tickets],
  )

  const replyDirty = selected
    ? reply !== (selected.suggested_reply || '')
    : false
  const approvedCurrent = Boolean(
    selected?.reply_status === 'Approved' && !replyDirty,
  )

  return (
    <Shell user={user} onLogout={onLogout}>
      <div className="agent-layout">
        <nav className="workspace-strip agent-strip" aria-label="Agent workspace">
          <span className="workspace-title">WORKSPACE</span>
          <span className="workspace-tab active" aria-current="page">
            Inbox <b>{activeCount}</b>
          </span>
        </nav>

        <section className="queue panel">
          <div className="panel-head">
            <div><span className="eyebrow">OPERATIONS</span><h2>Support Queue</h2></div>
            <span>{visible.length}</span>
          </div>

          <input
            className="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tickets…"
            aria-label="Search support tickets"
          />

          <div className="filters" aria-label="Ticket status filters">
            {['All', 'Open', 'In Progress', 'Resolved'].map((value) => (
              <button
                type="button"
                key={value}
                className={filter === value ? 'active' : ''}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="queue-scroll">
            {loading ? (
              <div className="empty compact-empty"><strong>Loading queue…</strong></div>
            ) : visible.length ? (
              visible.map((ticket) => (
                <button
                  type="button"
                  key={ticket.id}
                  className={`queue-card ${selectedId === ticket.id ? 'selected' : ''}`}
                  onClick={() => selectTicket(ticket)}
                >
                  <div><span className="mono">{ticketId(ticket.id)}</span><Status value={ticket.status} /></div>
                  <strong>{ticket.title}</strong>
                  <p>{ticket.description}</p>
                  <footer>
                    <span>{ticket.customer_name || 'Legacy ticket'}</span>
                    {ticket.priority && <b>{ticket.priority}</b>}
                  </footer>
                </button>
              ))
            ) : (
              <div className="empty compact-empty">
                <strong>No tickets here</strong>
                <span>Try another filter or search.</span>
              </div>
            )}
          </div>
        </section>

        <main className="case panel">
          <Notice onClose={() => setNotice('')}>{notice}</Notice>

          {selected ? (
            <>
              <div className="case-head">
                <div>
                  <span className="mono">{ticketId(selected.id)}</span>
                  <h1>{selected.title}</h1>
                  <p>
                    {selected.customer_name || 'Legacy customer'}
                    {selected.customer_email && ` · ${selected.customer_email}`}
                  </p>
                </div>

                <div className="case-actions">
                  <select
                    value={selected.status}
                    onChange={(event) => changeStatus(event.target.value)}
                    disabled={Boolean(busy)}
                    aria-label="Ticket status"
                  >
                    <option>Open</option>
                    <option>In Progress</option>
                    <option>Resolved</option>
                  </select>
                  <button
  type="button"
  className="danger danger-compact"
  onClick={remove}
  disabled={Boolean(busy)}
>
  Delete
</button>
                </div>
              </div>

              <div className="conversation-label">CONVERSATION</div>

              <div className="message customer-message">
                <span>CUSTOMER</span>
                <p>{selected.description}</p>
              </div>

              {selected.reply_status === 'Approved' && (
                <div className="message agent-message">
                  <span>SUPPORT · APPROVED</span>
                  <p>{selected.suggested_reply}</p>
                </div>
              )}

              <div className="composer">
                <div className="composer-head">
                  <strong>Response composer</strong>
                  <span>{replyDirty ? 'Edited' : selected.reply_status || 'Draft'}</span>
                </div>

                <textarea
                  rows="8"
                  maxLength="10000"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Run AI analysis or write a response…"
                />

                <div className="composer-actions">
                  <span>Human review required before customer delivery</span>
                  <div>
                    <button
                      type="button"
                      className="ghost"
                      disabled={!reply.trim() || !replyDirty || Boolean(busy)}
                      onClick={saveReply}
                    >
                      {busy === 'save' ? 'Saving…' : 'Save Draft'}
                    </button>

                    {approvedCurrent ? (
                      <span className="approved-chip">✓ Approved</span>
                    ) : (
                      <button
                        type="button"
                        className="primary"
                        disabled={!reply.trim() || Boolean(busy)}
                        onClick={approve}
                      >
                        {busy === 'approve' ? 'Approving…' : 'Approve Response'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty detail-empty">
              <strong>Select a support case</strong>
              <span>Choose a ticket from the queue to begin.</span>
            </div>
          )}
        </main>

        <aside className="copilot panel">
          <div className="panel-head">
            <div><span className="eyebrow">AI ASSIST</span><h2>AI Copilot</h2></div>
            <span className="spark">✦</span>
          </div>

          {selected ? (
            !selected.ai_summary ? (
              <div className="copilot-empty">
                <span className="big-spark">✦</span>
                <h3>Ready to analyze</h3>
                <p>Generate category, priority, summary and a suggested response.</p>
                <button type="button" className="primary wide" onClick={analyze} disabled={Boolean(busy)}>
                  {busy === 'analyze' ? 'Analyzing…' : 'Run AI Analysis'}
                </button>
              </div>
            ) : (
              <div className="diagnostics">
                <div className="diag-grid">
                  <article><span>PRIORITY</span><strong>{selected.priority || '—'}</strong></article>
                  <article><span>CATEGORY</span><strong>{selected.category || '—'}</strong></article>
                </div>

                <article className="summary-card">
                  <span>AI SUMMARY</span>
                  <p>{selected.ai_summary}</p>
                </article>

                <article className="suggestion-card">
                  <span>✦ SUGGESTED RESPONSE</span>
                  <p>{selected.suggested_reply || 'No suggested response available.'}</p>
                </article>

                <button type="button" className="ghost wide" onClick={analyze} disabled={Boolean(busy)}>
                  {busy === 'analyze' ? 'Analyzing…' : 'Re-run analysis'}
                </button>
              </div>
            )
          ) : (
            <div className="empty compact-empty">
              <strong>No active case</strong>
              <span>Select a ticket to open diagnostics.</span>
            </div>
          )}
        </aside>
      </div>
    </Shell>
  )
}

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY))
    } catch {
      return null
    }
  })
  const [checking, setChecking] = useState(Boolean(session))
  const sessionToken = session?.token || ''

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY)
    setSession(null)
    setChecking(false)
  }, [])

  const authenticated = useCallback(({ token, user }) => {
    const next = { token, user }
    localStorage.setItem(AUTH_KEY, JSON.stringify(next))
    setSession(next)
  }, [])

  useEffect(() => {
    if (!sessionToken) return undefined

    let active = true

    api('/auth/me', {}, sessionToken)
      .then(({ user }) => {
        if (!active) return
        const next = { token: sessionToken, user }
        localStorage.setItem(AUTH_KEY, JSON.stringify(next))
        setSession(next)
      })
      .catch(() => {
        if (active) logout()
      })
      .finally(() => {
        if (active) setChecking(false)
      })

    return () => {
      active = false
    }
  }, [logout, sessionToken])

  if (checking) {
    return (
      <div className="boot">
        <div className="brand"><span className="brand-mark">S</span><span>SUPPORT/OS</span></div>
        <span>Connecting to support workspace…</span>
      </div>
    )
  }

  if (!session) return <AuthScreen onAuthenticated={authenticated} />

  return session.user.role === 'agent'
    ? <AgentPortal session={session} onLogout={logout} />
    : <CustomerPortal session={session} onLogout={logout} />
  }
