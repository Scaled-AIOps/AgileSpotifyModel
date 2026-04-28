# Agile Spotify Model

Management tool for organisations running the Spotify Agile Model. Covers the entity hierarchy (Domains → Sub-Domains → Tribes → Squads → Members), application health monitoring, and admin headcount management. Sprint and backlog tracking is delegated to Jira; this app links out to it.

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 + Express + TypeScript, bundled with webpack |
| Frontend | Angular 21 standalone components |
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

### 3. Seed data

The backend automatically seeds **non-production** environments at startup from the YAML files in `backend/config/` (`tribedomains.yaml`, `subdomains.yaml`, `tribes.yaml`, `squads.yaml`, `infra.yaml`, `appinfo.yaml`, `appstatus.yaml`). The seed is idempotent: missing entities are created, existing ones are skipped — never overwritten. Production startup skips the YAML seed entirely.

YAML files are not bundled into `dist/`; the deploy pipeline mounts `config/` next to `dist/server.js` at runtime (`CONFIG_DIR` env var overrides the default `./config`).

The YAML files don't carry user accounts or password hashes. To bootstrap demo users on a fresh Redis, run the dev-only script:

```bash
cd backend
npm run seed                    # creates 27 demo users + populates the org
```

Demo data: 27 users · 4 domains · 15 sub-domains · 8 tribes · 16 squads · ~50 applications

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

`POST /auth/login` and `POST /auth/register` are additionally rate-limited to 20 requests per 15 minutes per IP to deter brute-force attacks.

### System endpoints (top-level, public, no `/api/v1` prefix)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Overall liveness — always returns `{ status: "ok" }` |
| `GET` | `/health/liveness` | Process is up (cheap, no external calls) — for k8s liveness probe |
| `GET` | `/health/readiness` | Pings Redis; 200 `{ status: "ok", redis: "ok" }` or 503 if Redis is down — for k8s readiness probe |
| `GET` | `/info` | Build metadata: `{ name, version, commitId, branch, buildTime }` |

`/info` reads `dist/package.json`, which webpack's `BuildInfoPlugin` emits on each `npm run build`. The plugin captures `commitId` / `branch` from `git rev-parse` at build time; CI environments with a detached worktree can override via `GIT_COMMIT` / `GIT_BRANCH` env vars before the build runs. In dev (`npm run dev`) `/info` falls back to `backend/package.json` (so commitId / branch / buildTime are blank).

### Roles

The role hierarchy used by `authorize()`:

| Role | Rank | Notes |
|---|---|---|
| `Admin` | 4 | Full access |
| `AgileCoach` | 4 | Equivalent to Admin for management endpoints |
| `TribeLead` | 3 | Can create squads / apps, modify squads in own tribe |
| `PO` | 2 | Can update own squad |
| `ReleaseManager` | 2 | Can record deploys |
| `Member` | 1 | Read-only, plus squad-role updates |

`authorize('TribeLead')` admits any role with rank ≥ 3.

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

# Patch an app with multi-link arrays + per-cloud deployment blocks
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  http://localhost:3000/api/v1/apps/auth-api -d '{
    "description": "Identity & SSO API",
    "ocp": {
      "intPlatform": "backend-int-cluster",
      "intUrl":      "https://gw-int-auth-api.intranet.example.com",
      "buildChart":  "ocp-node-build",
      "chart":       "ocp-node"
    },
    "gcp": {
      "intPlatform": "backend-int-cluster",
      "intUrl":      "https://gw-int-auth-api.gcp.example.com"
    },
    "jira":   [{ "url": "https://jira.example.com/projects/AUTH", "description": "Main board" }],
    "github": [{ "url": "https://github.com/example/auth-api", "description": "" }]
  }' | jq
```

### Bruno collection

The repo ships a Bruno collection under [`backend/bruno/`](backend/bruno/) covering every route. Open it in Bruno (https://usebruno.com) and select the `local` environment to run requests against `http://localhost:3000` with whichever access token you paste in.

---

## Project Structure

```
AgileSpotifyModel/
├── .gitignore
├── README.md
│
├── backend/
│   ├── config/                ← injected by deploy pipeline next to dist/
│   │   ├── .env               (not committed)
│   │   ├── tribedomains.yaml
│   │   ├── subdomains.yaml
│   │   ├── tribes.yaml        ← `name` is short code, `tribeName` is long form
│   │   ├── squads.yaml
│   │   ├── infra.yaml
│   │   ├── appinfo.yaml
│   │   └── appstatus.yaml
│   ├── webpack.config.js      ← bundles src/ → dist/server.js
│   ├── bruno/                 Bruno API collection (one folder per entity)
│   ├── scripts/seed.ts        dev-only: seeds demo users + org
│   ├── dist/                  webpack output (single bundled server.js)
│   └── src/
│       ├── config/            env.ts (Zod-validated), redis.ts
│       ├── lib/               id.ts (UUID v4), crypto.ts (bcrypt),
│       │                       links.ts (Link[] serialise/parse helpers),
│       │                       seed-yaml.ts (idempotent startup seed)
│       ├── middleware/        auth (JWT), authorize (role guard), validate (Zod), errorHandler
│       ├── models/            TypeScript interfaces for all entities
│       ├── schemas/           Zod request schemas, links.schema.ts (shared link fields)
│       ├── services/          Redis data access (one file per entity)
│       └── routes/            Express routers (one file per entity)
│
└── frontend/
    └── src/app/
        ├── core/
        │   ├── auth/          AuthService (Signals), JWT interceptor, guards
        │   ├── api/           typed API clients per entity
        │   ├── config/        ConfigService — loads /auth/config on startup
        │   ├── feature-flags/ FeatureFlagsService (localStorage)
        │   └── models/        TypeScript interfaces incl. Link
        ├── shared/
        │   ├── link-list/     read-only Link[] renderer
        │   └── link-repeater/ edit-form Link[] widget (URL + description rows)
        ├── shell/             top nav layout
        └── features/
            ├── auth/          login page, OAuth callback
            ├── dashboard/     role-aware fleet/tribe/squad health
            ├── apps/          application list (CSV/JSON/YAML export), detail, registration form, infra clusters
            ├── org-directory/ D3 collapsible tree, domain/tribe/squad views
            └── admin/         member CRUD, headcount chart, feature flags
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
| `description` | free-text summary of what the app does |
| `javaComplianceStatus` | `compliant` · `non-compliant` · `exempt` |
| `xrayUrl` | URL to JFrog Xray scan report (empty = no scan) |
| `tags.criticality` | `critical` · `high` · `medium` · `low` |
| `tags.pillar` | free-text organisational pillar |
| `tags.sunset` | planned decommission date |
| Probe URLs | `probeHealth`, `probeLiveness`, `probeReadiness`, `probeInfo` |
| Tool links | `artifactoryUrl`, `splunkUrl`, `xrayUrl`, `compositionViewerUrl` |
| `jira[]` · `confluence[]` · `github[]` · `mailingList[]` · `links[]` | Each is a list of `{url, description}` (see Multi-link arrays below). `links[]` is a generic miscellaneous bucket for architecture docs, pipelines, dashboards, etc. |
| Platform deployments | Per-cloud `ocp:` and `gcp:` blocks, each with `{env}Platform`, `{env}Url` (env ∈ local/dev/int/uat/prd), `buildChart`, `chart`. The seed loader namespaces them as `ocp.int`, `gcp.uat`, etc. on the App's `platforms` / `urls` maps. |

### App YAML shape

`config/appinfo.yaml` records use a per-cloud nested structure:

```yaml
- appId: auth-api
  gitRepo: https://github.com/example/auth-api
  squad: platform
  ocp:
    intPlatform: backend-int-cluster
    uatPlatform: backend-uat-cluster
    prdPlatform: backend-prd-cluster
    intUrl: https://gw-int-auth-api.intranet.example.com
    uatUrl: https://gw-uat-auth-api.intranet.example.com
    prdUrl: https://gw-prd-auth-api.intranet.example.com
    buildChart: ocp-node-build
    chart: ocp-node
  gcp:
    intPlatform: backend-int-cluster
    uatPlatform: backend-uat-cluster
    prdPlatform: backend-prd-cluster
    intUrl: https://gw-int-auth-api.gcp.example.com
    uatUrl: https://gw-uat-auth-api.gcp.example.com
    prdUrl: https://gw-prd-auth-api.gcp.example.com
  probeHealth:    /health
  probeInfo:      /info
  probeLiveness:  /health/liveness
  probeReadiness: /health/readiness
  status: active
  tags: { criticality: high, pillar: platform }
```

The legacy flat `intPlatform` / `intUrl` / … fields at the app level are still accepted by the seed loader (back-compat) and surface unprefixed in the App's `platforms` map.

## Multi-link arrays

Five entity types — `Domain`, `SubDomain`, `Tribe`, `Squad`, `App` — each carry four labelled link arrays: `jira`, `confluence`, `github`, `mailingList`. Apps carry an additional generic `links` array for things that don't fit those buckets (architecture docs, pipelines, dashboards). Each entry is a `Link` object:

```ts
interface Link {
  url: string;
  description: string;   // optional human label, e.g. "Main board"
}
```

In API requests you may also send a bare URL string or an array of URL strings; the zod schema coerces them to `[{url, description: ''}]` for back-compat. Output is always normalised to `Link[]`. URLs are validated to start with `http://` or `https://` (mailing-list entries also accept plain email addresses).

In the frontend, two shared standalone components render and edit these arrays:
- [`<app-link-list>`](frontend/src/app/shared/link-list/link-list.component.ts) — read-only display on detail pages
- [`<app-link-repeater>`](frontend/src/app/shared/link-repeater/link-repeater.component.ts) — repeater rows (URL + description + remove button) for edit forms

## Tribe naming

`Tribe.name` is a short code (e.g. `INF`, `PSS`); `Tribe.tribeName` is the long form (e.g. *"Infrastructure"*, *"Payment System Services"*). Detail pages show the long name with the short code as a monospace badge. The YAML loader accepts either form when other entities reference a tribe.
