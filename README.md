# Agile Spotify Model

Management tool for organisations running the Spotify Agile Model. Covers the full entity hierarchy (Domains → Sub-Domains → Tribes → Squads / Chapters / Guilds / Members), application health monitoring, backlog and sprint tracking, and admin headcount management.

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 + Express + TypeScript |
| Frontend | Angular 17 standalone components |
| Data | Redis 7 (sole data store — no SQL) |
| Auth | JWT (access 15 min in-memory, refresh 7 d HttpOnly cookie) + optional Jira / Microsoft SSO |

## Quick Start

### 1. Backend

```bash
cd backend
cp ../.env.example config/.env   # fill in JWT_SECRET, JWT_REFRESH_SECRET, REDIS_URL
npm install
npm run dev                       # hot-reload on http://localhost:3000
```

### 2. Frontend

```bash
cd frontend
npm install
npx ng serve                      # dev server on http://localhost:4200
```

### 3. Seed demo data

```bash
cd backend
npm run seed
```

Seed creates: 27 users · 4 domains · 15 sub-domains · 8 tribes · 16 squads · 6 chapters · 6 guilds · 4 active sprints · 24 applications

Default login: **admin@example.com / Admin1234!**

### 4. Run tests

```bash
# Backend (Vitest)
cd backend && npx vitest run

# Frontend (Karma + Jasmine)
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

---

## Environment Variables (`backend/config/.env`)

Copy `.env.example` to `backend/config/.env` and edit.

### Core

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | — | Access token signing key (min 16 chars) |
| `JWT_REFRESH_SECRET` | — | Refresh token signing key (min 16 chars) |
| `JWT_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token TTL |
| `PORT` | `3000` | Backend port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `CORS_ORIGIN` | `http://localhost:4200` | Frontend origin for CORS |
| `FRONTEND_URL` | *(falls back to `CORS_ORIGIN`)* | OAuth redirect base URL |
| `BACKEND_URL` | `http://localhost:3000` | OAuth callback base URL |

### Authentication

| Variable | Default | Description |
|---|---|---|
| `AUTH_BASIC_ENABLED` | `true` | Enable username + password login |
| `JIRA_ENABLED` | `false` | Enable Jira / Atlassian SSO |
| `JIRA_CLIENT_ID` | — | Atlassian OAuth 2.0 client ID |
| `JIRA_CLIENT_SECRET` | — | Atlassian OAuth 2.0 client secret |
| `AD_ENABLED` | `false` | Enable Microsoft Azure AD / Entra SSO |
| `AZURE_CLIENT_ID` | — | Azure app registration client ID |
| `AZURE_TENANT_ID` | `common` | Azure tenant ID (or `common` for multi-tenant) |
| `AZURE_CLIENT_SECRET` | — | Azure app registration client secret |

Any combination of `AUTH_BASIC_ENABLED`, `JIRA_ENABLED`, and `AD_ENABLED` can be active simultaneously. The frontend login page automatically shows only the methods that are enabled.

---

## SSO Setup

### Jira / Atlassian OAuth 2.0

1. Create an OAuth 2.0 (3LO) app at [developer.atlassian.com/console/myapps](https://developer.atlassian.com/console/myapps/)
2. Add callback URL: `${BACKEND_URL}/api/v1/auth/jira/callback`
3. Required scope: `read:me`
4. Set `JIRA_ENABLED=true`, `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET` in `.env`

### Microsoft Azure AD / Entra ID

1. Register an app at [portal.azure.com](https://portal.azure.com) → App registrations
2. Add redirect URI (Web): `${BACKEND_URL}/api/v1/auth/microsoft/callback`
3. Under *Certificates & secrets* create a client secret
4. Set `AD_ENABLED=true`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` in `.env`

> **User provisioning:** SSO users are matched by email. The user account must already exist in the system (created by an Admin) with the same email address as the identity provider account. There is no auto-provisioning.

---

## API

Base URL: `http://localhost:3000/api/v1`

All endpoints require `Authorization: Bearer <token>` except `POST /auth/login` and `GET /auth/config`.

### Roles

`Admin` > `TribeLead` > `PO` > `AgileCoach` > `ReleaseManager` > `Member`

### Auth endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/config` | Public | Returns `{ basic, jira, ad }` flags |
| `POST` | `/auth/register` | Admin | Create a user account |
| `POST` | `/auth/login` | Public | Basic login → access + refresh token |
| `POST` | `/auth/refresh` | Cookie | Exchange refresh cookie for new access token |
| `POST` | `/auth/logout` | Bearer | Revoke refresh token |
| `GET` | `/auth/me` | Bearer | Current user profile |
| `PATCH` | `/auth/me/password` | Bearer | Change password |
| `GET` | `/auth/jira` | Public | Initiate Jira OAuth flow |
| `GET` | `/auth/jira/callback` | Public | Jira OAuth callback |
| `GET` | `/auth/microsoft` | Public | Initiate Microsoft OAuth flow |
| `GET` | `/auth/microsoft/callback` | Public | Microsoft OAuth callback |

### Example curl

```bash
# Login (basic)
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin1234!"}' | jq -r .accessToken)

# Full org tree
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/org/tree | jq

# All applications
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/apps | jq
```

---

## Project Structure

```
AgileSpotifyModel/
├── .env.example              ← copy to backend/config/.env
├── .gitignore
├── README.md
│
├── backend/
│   ├── config/
│   │   └── .env              ← not committed
│   ├── src/
│   │   ├── config/           env.ts (Zod-validated), redis.ts
│   │   ├── lib/              id.ts (UUID v4), crypto.ts (bcrypt)
│   │   ├── middleware/       auth (JWT), authorize (role guard), validate (Zod), errorHandler
│   │   ├── models/           TypeScript interfaces for all entities
│   │   ├── schemas/          Zod request schemas
│   │   ├── services/         Redis data access (one file per entity)
│   │   ├── routes/           Express routers (one file per entity)
│   │   └── scripts/
│   │       └── seed.ts       demo org + apps
│   └── package.json
│
└── frontend/
    └── src/app/
        ├── core/
        │   ├── auth/         AuthService (Signals), JWT interceptor, guards
        │   ├── api/          typed API clients per entity
        │   ├── config/       ConfigService — loads /auth/config on startup
        │   ├── feature-flags/ FeatureFlagsService (localStorage)
        │   └── models/       TypeScript interfaces
        ├── shell/            top nav layout
        └── features/
            ├── auth/         login page, OAuth callback
            ├── dashboard/    role-aware: fleet health (Admin), tribe health (TribeLead), squad app health (PO/Member)
            ├── apps/         application list (CSV/JSON/YAML export), detail, registration form, infra clusters
            ├── org-directory/ D3 collapsible tree, domain/tribe/squad/chapter/guild views
            ├── work-tracking/ backlog (drag-drop priority), sprint Kanban board
            └── admin/        member CRUD, headcount chart, feature flags
```

---

## Dashboard Views

The dashboard adapts to the logged-in user's role:

| Role | View |
|---|---|
| Admin / AgileCoach | Fleet-wide headcount chart + application health tiles (active / failed / Java non-compliant / no Xray) |
| TribeLead | Tribe squad cards with app health micro-dots + compliance summary |
| PO / Member | Squad app health table (running status, Java compliance, Xray scan, criticality) |

## Application Health

Each application tracks:

| Field | Values |
|---|---|
| `status` | `active` · `inactive` · `failed` · `marked-for-decommissioning` |
| `javaComplianceStatus` | `compliant` · `non-compliant` · `exempt` |
| `xrayUrl` | URL to JFrog Xray scan report (empty = no scan) |
| `tags.criticality` | `critical` · `high` · `medium` · `low` |
| `tags.pillar` | free-text organisational pillar |
| `tags.sunset` | planned decommission date |
| Probe URLs | `probeHealth`, `probeLiveness`, `probeReadiness`, `probeInfo` |
| Tool links | `gitRepo`, `artifactoryUrl`, `splunkUrl`, `compositionViewerUrl` |
