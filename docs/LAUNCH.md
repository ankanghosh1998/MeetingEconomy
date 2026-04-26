# MeetingEconomy Launch Runbook

This runbook covers the remaining external launch work after the codebase is built.

## 1. Production Infrastructure

- Web: Vercel project for `apps/web`
- API: Render, Railway, or AWS service for `apps/api`
- Worker: separate background worker process using `npm run start:worker -w @meetingeconomy/api`
- PostgreSQL: Supabase or RDS
- Redis: Upstash, Railway Redis, or ElastiCache
- Domain: `meetingeconomy.io`

## 2. Required Production Environment

Set these on the API and worker:

```text
NODE_ENV=production
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
ENCRYPTION_KEY=
API_URL=https://api.meetingeconomy.io
WEB_URL=https://meetingeconomy.io
CORS_ORIGIN=https://meetingeconomy.io
READINESS_CHECK_REDIS=true
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://api.meetingeconomy.io/auth/google/callback
GOOGLE_CALENDAR_REDIRECT_URI=https://api.meetingeconomy.io/integrations/google/callback
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=https://api.meetingeconomy.io/integrations/microsoft/callback
OPENAI_API_KEY=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=reports@meetingeconomy.io
```

Set this on Vercel:

```text
NEXT_PUBLIC_API_URL=https://api.meetingeconomy.io
```

Generate secrets:

```bash
openssl rand -base64 48 # JWT_SECRET
openssl rand -base64 32 # ENCRYPTION_KEY
```

## 3. OAuth Provider Setup

Google Cloud OAuth:

- Authorized JavaScript origin: `https://meetingeconomy.io`
- Login redirect URI: `https://api.meetingeconomy.io/auth/google/callback`
- Calendar redirect URI: `https://api.meetingeconomy.io/integrations/google/callback`
- Scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar.events.readonly`

Microsoft Entra:

- Redirect URI: `https://api.meetingeconomy.io/integrations/microsoft/callback`
- API permissions: `User.Read`, `Calendars.Read`, `offline_access`

## 4. Deploy

```bash
npm install
npm run db:generate
npm run db:deploy
npm run build
npm run launch:check
```

Start processes:

```bash
npm run start -w @meetingeconomy/api
npm run start:worker -w @meetingeconomy/api
```

## 5. Smoke Tests

- `GET https://api.meetingeconomy.io/health`
- `GET https://api.meetingeconomy.io/health/ready`
- Sign up with a test admin
- Connect Google Calendar
- Connect Microsoft Calendar
- Upload `sample-data/employees.csv`
- Confirm dashboard totals and meeting flags
- Generate a MOM and send email to a test attendee list

## 6. Launch Gate

Do not launch publicly until all are true:

- DNS and TLS are active for web and API
- OAuth apps are verified or test-mode limits are acceptable
- SendGrid sender/domain authentication is complete
- Privacy Policy and Terms have counsel-approved copy
- Database backups and retention are configured
- Error/log monitoring destination is configured
- `npm run build`, `npm test`, and `npm run launch:check` pass in CI

## Known Audit Note

`npm audit --omit=dev` currently reports a moderate advisory for BullMQ's transitive `uuid@11.1.0`.
BullMQ is pinned to the latest available release in this codebase. npm's suggested fix downgrades BullMQ to an unusable
placeholder version, so the launch gate uses `npm run audit:prod`, which fails on high or critical production advisories.
Re-check this after every BullMQ release.
