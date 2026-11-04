# HYPREP - Freedom of Information (FOI) Management System

Production-grade FOI case management for the Legal Unit of the Hydrocarbon
Pollution Remediation Project (HYPREP), built to the Terms of Reference.

The platform is backed by Convex and Better Auth. Cases, documents, notes,
tasks, hearings, notifications, reports, settings and audit records are read
from and written to the configured deployment. The frontend does not include a
mock-data fallback.

- Theme: Nigerian green (`#008751`) and white, with the Coat of Arms as the logo
- Statutory basis: Freedom of Information Act 2011
- Locale: English (Nigeria), Africa/Lagos timezone
- Accessibility target: WCAG 2.1 AA

## Running locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `VITE_CONVEX_URL` to the URL for the
Convex deployment. Configure the server-side Better Auth and integration
secrets with `npx convex env set`.

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run typecheck` | Type-check the app and Node configuration. |
| `npm run smoke` | Load the live adapters and feature module graph through Vite SSR. |
| `npm run build` | Produce the production bundle. |
| `npm run verify` | Run typecheck, smoke and build in sequence. |
| `npm run check:backend` | Check the Convex source surface. |

Requires Node 18 or newer.

## Authentication and initial data

Authentication uses Better Auth through Convex. Email/password sign-in,
registration, password recovery, MFA and optional Microsoft Entra ID SSO use the
configured backend; there are no demo accounts, fixed passwords or role
switchers in the application.

On a new deployment, initialize the reference data and optional commissioning
administrator with:

```bash
npx convex run seed:run
```

The seed command is an operator-only, idempotent database initialization for
roles, departments, courts, taxonomy and system settings. It is not callable
by the browser and does not create an administrator with default credentials.
Set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (at least 12 characters) and
optionally `SEED_ADMIN_NAME` on the target deployment before running it to
commission an administrator. Remove the password environment variable after
commissioning.

## Production deployment

The production frontend is `https://foi-hyprep.vercel.app`; its Convex backend
is `compassionate-caterpillar-373` in `eu-west-1`. `vercel.json` sets the public
production backend URLs at build time, proxies `/api/auth/*` to the backend,
and serves the SPA entry point for client-side routes such as `/login`.

Configure these server-side variables on production, not in `.env.local`:

- `BETTER_AUTH_SECRET`: a cryptographically random secret with at least 32 bytes.
- `BETTER_AUTH_URL`: `https://foi-hyprep.vercel.app`.
- `FRONTEND_ORIGINS`: `https://foi-hyprep.vercel.app`.

Then deploy and initialize the reference data:

```bash
npx convex deploy
npx convex run --prod seed:run
```

Deploy the frontend to the existing Vercel project after the backend deploy
passes. Auth routes must return JSON rather than the SPA HTML or a Vercel 404.

## Main capabilities

- Request intake with statutory due dates and requestor self-service
- Server-scoped case lists, review queues, assignments, status changes, appeals
  and closure
- Convex file storage with document versions, signed preview URLs, redaction and
  access logging
- Internal/public notes, tasks, timeline events and linked cases
- Live court diary, hearing outcomes and reminders
- Live dashboards, statutory reports, custom report builder and CSV exports
- User, role, organisation, system settings, integrations and bulk import
- Permission-scoped global search and immutable audit/access views
- Notification preferences, email/SMS/webhook actions and scheduled jobs

## Role model

The seven roles are defined in `src/lib/rbac.ts` and enforced again in
`convex/lib/permissions.ts`:

- Super-Admin: platform settings, monitoring, backups and integrations
- Admin: users, roles, reference data and assignment
- Legal Unit: casework, review, documents, templates, court and reports
- Clerk / Support: registry intake, documents and scheduling
- Requestor: submit and track owned requests, responses and appeals
- Auditor: read-only audit and operational access
- External Stakeholder: scoped access to assigned litigation

## Project structure

```text
src/
  app/          Entry, router, route guards and provider tree
  api/          Typed adapters for live Convex queries and mutations
  components/   UI primitives, charts, layout and shared page furniture
  features/     Auth, dashboard, cases, court, documents, reports and admin
  hooks/        Debounced values and asynchronous UI helpers
  lib/          RBAC, navigation, SLA, constants, formatting and utilities
  store/        AuthContext, DataContext and ToastContext
  types/        Shared frontend domain types
convex/
  schema.ts     Application schema
  queries/      Permission-scoped reads
  mutations/    Transactional writes
  actions/      Email, SMS, storage and processing integrations
  crons.ts      Scheduled SLA, reminder, retention and delivery jobs
scripts/        Smoke and backend checks
```

## Backend setup

Convex contains the schema, reactive queries, mutations, actions, cron jobs,
HTTP API and file storage. Better Auth owns authentication tables and the app
user profile is linked through `authUserId`.

Set these values for a real deployment as applicable:

- `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` for the browser
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `FRONTEND_ORIGINS`
- Entra ID credentials when staff SSO is enabled
- Resend, Termii, ClamAV, OCR, document encryption, webhook and monitoring
  credentials for the corresponding integrations

Do not deploy with placeholder secrets. If Convex is unavailable, the UI keeps
the live loading/error state and never substitutes fabricated records.

## Verification

```bash
npm run typecheck
npm run smoke
npm run build
```

`npm run verify` runs all three checks in sequence.
