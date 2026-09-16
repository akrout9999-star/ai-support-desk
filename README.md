# SUPPORT/OS — AI Support Desk

SUPPORT/OS is a full-stack AI-assisted customer support platform that combines secure ticket management with Gemini-powered support diagnostics and a human-review workflow.

Customers can create and track their own support requests, while support agents manage the queue, analyze tickets with AI, edit suggested responses, approve replies, and move tickets through the support lifecycle.

## Features

### Customer Portal
- Secure customer registration and login
- Create support tickets
- View only tickets belonging to the logged-in customer
- Track ticket status: Open, In Progress, and Resolved
- View support responses only after agent approval
- Dashboard statistics for total, active, and resolved requests

### Support Agent Workspace
- Dedicated role-protected agent dashboard
- View and search the support queue
- Filter tickets by status
- Update ticket status
- Delete tickets
- Review customer information and conversations
- Edit and save response drafts
- Approve responses before customer delivery

### Gemini AI Copilot
Agents can run AI analysis on a support request to generate:

- Category
- Priority
- Concise issue summary
- Suggested customer response

AI-generated responses are not sent directly to customers. An agent reviews, edits, and explicitly approves the response before it becomes visible in the Customer Portal.

## Human-in-the-Loop Workflow

```text
Customer creates ticket
        ↓
Agent receives ticket
        ↓
Gemini analyzes request
        ↓
Category + Priority + Summary + Suggested Reply
        ↓
Human agent reviews / edits response
        ↓
Agent approves response
        ↓
Customer receives approved reply
        ↓
Ticket progresses toward resolution
```

## Tech Stack

### Frontend
- React 19
- Vite
- JavaScript
- CSS
- Fetch API

### Backend
- Node.js
- Express.js
- JWT authentication
- bcryptjs
- Google Gemini API

### Database
- SQLite
- better-sqlite3

## Authentication & Authorization

SUPPORT/OS uses JWT-based authentication with separate Customer and Agent roles.

The backend enforces authorization rather than relying only on frontend routing.

Customers can access only their own tickets, while agent-only operations such as AI analysis, status management, reply approval, and deletion are protected by role-based middleware.

Passwords are stored as bcrypt hashes.

## Ticket Lifecycle

```text
Open → In Progress → Resolved
```

Each ticket can also contain internal AI-generated information such as category, priority, summary, and a suggested response.

These internal fields are available to support agents but are not exposed to customers. Customers receive only an approved support response.

## API Overview

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/:id

POST   /api/tickets/:id/analyze
PATCH  /api/tickets/:id/status
PATCH  /api/tickets/:id/reply
PATCH  /api/tickets/:id/reply/approve
DELETE /api/tickets/:id
```

Access to ticket endpoints depends on the authenticated user's role and ticket ownership.

## Environment Variables

Create a `.env` file inside the `backend` directory.

```env
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_long_random_jwt_secret

AGENT_NAME=Your Agent Name
AGENT_EMAIL=agent@example.com
AGENT_PASSWORD=your_secure_agent_password

CLIENT_ORIGIN=http://localhost:5173
```

Never commit the real `.env` file or production credentials.

The repository includes `.env.example` files to document required configuration safely.

## Running Locally

### 1. Clone the repository

```bash
git clone <repository-url>
cd ai-support-desk
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

Create the backend `.env` file using `.env.example` as a reference.

Start the API:

```bash
npm start
```

The backend runs on:

```text
http://localhost:5000
```

### 3. Install frontend dependencies

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The development frontend is available through the URL displayed by Vite.

## Production Validation

Frontend code can be checked with:

```bash
npm run lint
npm run build
```

The application has been tested through the complete workflow from customer ticket creation to AI analysis, human approval, and customer-visible resolution.

## Security Considerations

- Password hashing with bcrypt
- JWT-based authentication
- Role-based API authorization
- Customer-level ticket ownership checks
- Agent-only administrative operations
- Server-side Gemini API integration
- Environment-based secrets
- Internal AI diagnostics hidden from customers
- Human approval required before AI-assisted replies reach customers

## Screenshots

Screenshots of the Customer Portal and Support Agent Workspace will be added with the public deployment.

## Live Demo

Deployment link coming soon.

## Project Status

Core application development is complete.

Current functionality includes authentication, customer-isolated ticket management, agent operations, Gemini AI analysis, human-reviewed responses, SQLite persistence, responsive UI, loading and error states, and production frontend validation.

## Author

**Asish Kumar Rout**  
B.Tech — Computer Science & Engineering  
Government College of Engineering, Keonjhar

GitHub: `akrout9999-star`  
Portfolio: `asish.pages.dev`