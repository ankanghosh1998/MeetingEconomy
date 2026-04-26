# MeetingEconomy

MeetingEconomy is a full-stack SaaS MVP for meeting cost analytics, waste detection, calendar sync, post-meeting feedback, and AI-generated Minutes of Meeting emails.

## Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, ShadCN-style UI primitives
- Backend: Express REST API with TypeScript
- Database: PostgreSQL with Prisma
- Auth: JWT email/password and Google OAuth
- Jobs: BullMQ with Redis
- Integrations: Google Calendar and Microsoft Graph
- AI: OpenAI Chat Completions API for MOM generation
- Email: SendGrid or SMTP

## Repository Structure

```text
apps/
  api/      Express API, jobs, services, tests
  web/      Next.js app
packages/
  db/       Prisma schema, generated client, seed
  types/    Shared API/domain types
docs/
  API.md    REST API documentation
sample-data/
  employees.csv
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment values:

```bash
cp .env.example .env
```

3. Start PostgreSQL and Redis:

```bash
npm run infra:up
```

4. Create tables and seed sample data:

```bash
npm run db:migrate
npm run db:seed
```

5. Run the app:

```bash
npm run dev
```

Web: `http://localhost:3000`

API: `http://localhost:4000`

Run workers for recurring BullMQ jobs:

```bash
npm run worker
```

Or run API, web, and worker together:

```bash
npm run dev:full
```

Seed login:

```text
admin@acme.test / Password123!
```

## Required Environment Variables

```text
DATABASE_URL=
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OPENAI_API_KEY=
SENDGRID_API_KEY=
```

Optional but supported:

```text
REDIS_URL=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

Use `<UNSPECIFIED>` for provider keys that are not configured yet. The MOM generator falls back to a deterministic local formatter when `OPENAI_API_KEY` is not configured.

Before production launch, fill real production env vars and run:

```bash
npm run launch:check
```

See [docs/LAUNCH.md](docs/LAUNCH.md) for the deployment runbook.

## Core Feature Status

- Email/password signup and login: implemented
- JWT middleware and role middleware: implemented
- Google OAuth login: implemented
- Google Calendar OAuth and event sync: implemented
- Microsoft Graph OAuth and event sync: implemented
- Employee cost modes: average hourly, role salary bands, CSV upload
- Cost engine: ignores meetings under 5 minutes, caps all-day meetings at 8 hours, excludes external attendee emails
- Waste flags: large, long, recurring
- Dashboards: company, user, team
- MOM generation: OpenAI-backed with local fallback and cached outputs
- Email: SendGrid, SMTP, or console no-op fallback
- BullMQ jobs: 6-hour calendar sync, 6-hour cost recalculation, weekly report email

## Deployment

Frontend is ready for Vercel using `vercel.json`. Set `NEXT_PUBLIC_API_URL` to the deployed API URL.

Backend can deploy to Render, Railway, or AWS. `render.yaml` and `apps/api/Dockerfile` are included. Run Prisma migrations during release:

```bash
npm run db:deploy
```

Database can be Supabase or RDS PostgreSQL. Redis can be Upstash, Railway Redis, or AWS ElastiCache.

## Testing

```bash
npm test
```

Run browser smoke flow:

```bash
npm run test:e2e -w @meetingeconomy/web
```

## API Documentation

See [docs/API.md](docs/API.md).

## OpenAI Integration Note

The API uses the official Chat Completions endpoint (`POST /v1/chat/completions`) and keeps the model configurable with `OPENAI_MODEL`.
