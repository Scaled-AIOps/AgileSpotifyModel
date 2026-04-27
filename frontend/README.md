# Frontend — Agile Spotify Model

Angular 21 standalone-component SPA for the Agile Spotify Model management tool.

## Stack

- Angular 21 (standalone components, Signals, functional guards/interceptors)
- D3 v7 (org-directory collapsible tree)
- Karma + Jasmine (unit tests)

## Dev server

```bash
npm install
npx ng serve          # http://localhost:4200
```

Requires the backend to be running on `http://localhost:3000` (see `../backend`). The dev server reads `src/environments/environment.ts` (`apiUrl: http://localhost:3000/api/v1`) — no proxy needed.

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
| `/admin` | Admin | Member CRUD, headcount chart, feature flags (TribeLead+) |

## Auth

- Access token stored **in-memory** only (Angular Signal in `AuthService`)
- Refresh token in an **HttpOnly cookie** (set by backend, 7-day TTL)
- `JwtInterceptor` (functional `HttpInterceptorFn`) attaches `Authorization: Bearer` to every API request
- Route guards: `authGuard` (authenticated), `roleGuard('Admin')` (role-restricted)

## Shared components

Two shared standalone components handle the multi-link arrays present on Domains, SubDomains, Tribes, Squads, and Apps:

- [`<app-link-list>`](src/app/shared/link-list/link-list.component.ts) — read-only display: a labelled vertical list where each entry's description (or shortened URL fallback) becomes the visible link text.
- [`<app-link-repeater>`](src/app/shared/link-repeater/link-repeater.component.ts) — edit-form repeater: one row per link with a URL input, description input, and remove button; an "+ Add" button appends an empty row. Two-way binds via `[links]` / `(linksChange)`.

Both are imported individually by detail/edit components that need them — there is no NgModule.
