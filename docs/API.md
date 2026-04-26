# MeetingEconomy API

Base URL: `http://localhost:4000`

All protected endpoints require:

```http
Authorization: Bearer <jwt>
```

## Auth

### POST `/api/auth/signup`

```json
{
  "name": "Ada Admin",
  "email": "admin@acme.test",
  "password": "Password123!",
  "org_name": "Acme Operations"
}
```

Returns `{ token, user }`.

### POST `/api/auth/login`

```json
{
  "email": "admin@acme.test",
  "password": "Password123!"
}
```

Returns `{ token, user }`.

### GET `/api/auth/google`

Redirects to Google OAuth login. Callback returns to `/oauth/callback` with a short-lived exchange code.

### POST `/api/auth/oauth/exchange`

```json
{
  "code": "one-time-code"
}
```

Returns `{ token, user }` and invalidates the exchange code.

## Organization

### GET `/api/org`

Returns organization settings.

### PUT `/api/org`

Admin only.

```json
{
  "name": "Acme Operations",
  "domain": "acme.test",
  "cost_model": "SALARY_BANDS",
  "default_hourly_rate": 85,
  "currency": "USD"
}
```

## Calendar

### GET `/api/calendar/connect?provider=google`

Returns `{ url }` for Google Calendar OAuth.

### GET `/api/calendar/connect?provider=microsoft`

Returns `{ url }` for Microsoft Graph OAuth.

### POST `/api/calendar/sync`

Queues calendar sync for connected providers.

```json
{
  "provider": "google"
}
```

### GET `/api/calendar/events?from=2026-04-01T00:00:00.000Z&to=2026-04-30T23:59:59.000Z`

Returns stored calendar events:

```json
{
  "events": [
    {
      "meeting_id": "cuid",
      "title": "Roadmap Prioritization",
      "start": "2026-04-22T14:30:00.000Z",
      "end": "2026-04-22T15:20:00.000Z",
      "organizer_email": "admin@acme.test",
      "attendees": ["admin@acme.test"]
    }
  ]
}
```

## Employees And Roles

### GET `/api/employees`

Admin/Manager. Returns masked employee cost metadata. Individual salaries and hourly rates are never returned.

### POST `/api/employees/upload`

Admin only. Multipart form field `file` with CSV columns:

```csv
Name,Email,Role,Salary
Ada Admin,admin@acme.test,Product,160000
```

### GET `/api/employees/roles`

Returns role salary bands.

### POST `/api/employees/roles`

Admin only.

```json
{
  "title": "Engineering",
  "min_salary": 120000,
  "max_salary": 170000,
  "hourly_rate": null
}
```

## Meetings

### GET `/api/meetings`

Returns meeting list with cost and flags.

### GET `/api/meetings/:id`

Returns meeting detail, attendees, ratings, and latest summary.

### POST `/api/meetings/:id/rating`

```json
{
  "rating": 4,
  "comment": "Useful, but could be shorter."
}
```

### POST `/api/meetings/:id/summary`

```json
{
  "key_points": ["Reviewed quarterly roadmap"],
  "decisions": ["Move launch review to Friday"],
  "action_items": [
    {
      "task": "Send revised launch checklist",
      "owner": "Ada",
      "due_date": "2026-04-25"
    }
  ],
  "send_email": true
}
```

Returns generated email text and email delivery status.

## Dashboard

### GET `/api/dashboard/company`

Admin/Manager aggregate metrics.

### GET `/api/dashboard/team`

Admin/Manager team aggregate metrics.

### GET `/api/dashboard/user`

Current user's meeting metrics.

Response:

```json
{
  "total_cost": 1234,
  "total_hours": 42,
  "avg_cost_per_meeting": 180,
  "flagged_cost": 650,
  "trends": [],
  "breakdowns": {
    "by_organizer": [],
    "by_flags": []
  }
}
```

## Reports

### GET `/api/reports/weekly`

Returns weekly dashboard JSON.

### GET `/api/reports/weekly?format=csv`

Downloads a CSV report.
