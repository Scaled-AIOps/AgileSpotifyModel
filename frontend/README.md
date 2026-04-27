# Frontend — Agile Spotify Model

Angular 17 standalone-component SPA for the Agile Spotify Model management tool.

## Stack

- Angular 17 (standalone components, Signals, functional guards/interceptors)
- Angular Material + CDK
- D3 v7 (org-directory collapsible tree)
- Karma + Jasmine (unit tests)

## Dev server

```bash
npm install
npx ng serve          # http://localhost:4200
```

Requires the backend to be running on `http://localhost:3000` (see `../backend`).

## Build

```bash
npx ng build          # output → dist/
```

## Tests

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```

## Feature modules

| Route | Feature | Notes |
|---|---|---|
| `/auth/login` | Login | Basic + optional Jira/AD SSO |
| `/auth/callback` | OAuth callback | Receives token from SSO redirect |
| `/dashboard` | Dashboard | Role-aware: Admin / TribeLead / PO+Member |
| `/org` | Org Directory | D3 collapsible tree, domain/tribe/squad/chapter/guild views |
| `/apps` | Applications | List (CSV/JSON/YAML export), detail, registration |
| `/work` | Work Tracking | Backlog (drag-drop), Sprint Kanban |
| `/admin` | Admin | Member CRUD, headcount chart, feature flags |

## Auth

- Access token stored **in-memory** only (Angular Signal in `AuthService`)
- Refresh token in an **HttpOnly cookie** (set by backend, 7-day TTL)
- `JwtInterceptor` (functional `HttpInterceptorFn`) attaches `Authorization: Bearer` to every API request
- Route guards: `authGuard` (authenticated), `roleGuard('Admin')` (role-restricted)

## Environment / proxy

The Angular dev server proxies `/api` to `http://localhost:3000` via `proxy.conf.json`. For production, nginx (see `../backend/Dockerfile`) proxies `/api` to the backend container.
