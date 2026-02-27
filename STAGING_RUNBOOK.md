# Staging Runbook

Use this to get a staging environment live for stakeholder review and stress testing.

## Default Stack (Tailored)

- Frontend hosting: **Vercel**
- Backend hosting: **Render**
- Domain/DNS: **DreamHost**
- Database: **Render Postgres** (or any managed Postgres)

If you follow this stack, the steps below are copy/paste-ready except for your domain and service names.

## 1) Provision Staging Targets

- Frontend: Vercel project `yachtversal-staging`
- Backend: Render/Railway service `yachtversal-api-staging`
- Database: Separate staging Postgres
- Domain/DNS (DreamHost):
  - `staging.yachtversal.com` -> frontend
  - `staging-api.yachtversal.com` -> backend

Suggested naming:
- Vercel URL: `yachtversal-staging.vercel.app`
- Render URL: `yachtversal-api-staging.onrender.com`

## 2) Configure Environment Variables

- Backend template: `backend/.env.staging.example`
- Frontend template: `frontend/.env.staging.example`

Minimum required:
- Backend: `DATABASE_URL`, `SECRET_KEY`, `BASE_URL`, `SENDGRID_API_KEY`, `FROM_EMAIL`, `CORS_ORIGINS`
- Frontend: `NEXT_PUBLIC_API_URL`

## 3) Deploy Backend

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Render service settings:
- Runtime: Python 3
- Root directory: `backend`
- Auto deploy: enabled from your `staging` branch

Health check URL:

```text
https://staging-api.yachtversal.com/api/health
```

Expected:

```json
{"status":"ok","service":"yachtversal-backend"}
```

## 4) Deploy Frontend

- Import `frontend` project in Vercel.
- Set `NEXT_PUBLIC_API_URL=https://staging-api.yachtversal.com/api`.
- Deploy branch intended for stakeholder testing.

Vercel settings:
- Framework: Next.js
- Root directory: `frontend`
- Production branch for staging project: `staging`

## 4.1) DreamHost DNS Records (Exact Pattern)

Create/update these records in DreamHost DNS:

- `A` record:
  - Host: `staging`
  - Value: `76.76.21.21` (Vercel)
- `CNAME` record:
  - Host: `www.staging`
  - Value: `cname.vercel-dns.com`
- `CNAME` record:
  - Host: `staging-api`
  - Value: `yachtversal-api-staging.onrender.com`

Then add domains in providers:
- Vercel: `staging.yachtversal.com`
- Render: `staging-api.yachtversal.com`

## 5) Smoke Test (Manual)

- Open `https://staging.yachtversal.com`
- Log in as dealer/admin/sales rep test users
- Create/edit listing
- Upload image/video
- Send and receive a message
- Open dashboard tabs (team, analytics, api-keys)

## 6) Stress Test Starter (k6)

Script: `backend/load_tests/k6_stress.js`

Install k6 on Windows:

```powershell
winget install -e --id k6.k6
```

Run test:

```powershell
cd backend
k6 run .\load_tests\k6_stress.js -e BASE_URL=https://staging-api.yachtversal.com
```

## 7) Stakeholder Access

- Share staging URL: `https://staging.yachtversal.com`
- Create temporary test accounts or invite users via admin/team workflows
- Keep production credentials and live payment keys out of staging accounts

## 8) Go/No-Go Criteria for Production

- p95 API latency below target under load
- No 5xx spike during 10+ minute load test
- Image/video upload and retrieval verified
- Email, auth, and team analytics features verified

## 9) Stakeholder Share Message (Ready to Send)

Use this template in email/Slack:

"Staging is ready for review: `https://staging.yachtversal.com`.
Please focus on: login, listings CRUD, media upload, dashboard analytics/team, and API keys.
Stress-test window: [start time] to [end time].
Report issues with steps + screenshots + browser/device details."
