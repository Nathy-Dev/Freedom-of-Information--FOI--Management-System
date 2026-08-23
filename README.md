# HYPREP — Freedom of Information (FOI) Management System

Frontend prototype for the Legal Unit of the **Hydrocarbon Pollution Remediation
Project (HYPREP)**, built to the Terms of Reference for review before backend
development begins.

Every screen is complete and interactive. **All data is mock data** generated in
the browser — there is no server, no database and no network call. See
[What is mocked](#what-is-mocked) for exactly where the seam sits.

- **Theme:** Nigerian green (`#008751`) and white, with the Coat of Arms as the logo
- **Statutory basis:** Freedom of Information Act 2011 — 7-day response window,
  section 6 extension, section 18 severance, section 20 judicial review
- **Locale:** English (Nigeria), Africa/Lagos timezone, WCAG 2.1 AA target

---

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-checks and produces the production bundle in `dist/` |
| `npm run preview` | Serves the built bundle |
| `npm run typecheck` | `tsc --noEmit` over the app and the node configs |
| `npm run smoke` | Loads every module through Vite's SSR pipeline and renders all public screens — catches circular imports and barrel mistakes a typecheck cannot see |
| `npm run verify` | typecheck → smoke → build, in order |

Requires Node 18+.

---

## Signing in

The login screen carries a **demo account picker** — one click signs you in as any
role, no typing. That is the fastest way to walk a reviewer through the system.

To use the form instead: enter the email below with **any password of 4+
characters**. Accounts with MFA enabled then ask for a code — the demo code is
`123456`, shown as a hint under the field. **Continue with Microsoft Entra ID**
signs you in as the Head of Legal Unit.

| Role | Email | Lands on |
| --- | --- | --- |
| Super-Admin | `ibrahim.sanusi@hyprep.gov.ng` | `/dashboard/system` |
| Admin | `adaeze.nwachukwu@hyprep.gov.ng` | `/dashboard/admin` |
| Legal Unit | `ngozi.okonkwo@hyprep.gov.ng` | `/dashboard/legal` |
| Clerk / Support | `blessing.amadi@hyprep.gov.ng` | `/dashboard/legal` |
| Requestor | `nnimmo@healthofmotherearth.org` | `/my-requests` |
| Auditor (read-only) | `c.idowu@auditor-general.gov.ng` | `/dashboard/audit` |
| External Stakeholder | `u.nnamdi@nnamdichambers.ng` | `/my-requests` |

Once inside, **Switch account** in the profile menu (`/switch-account`) hops
between roles without signing out — useful in a live demo. The topbar also
carries a role switcher for the same purpose.

### What each role proves

- **Super-Admin** — system dashboard, settings, monitoring, backups, retention,
  API clients and webhooks, bulk import
- **Admin** — user directory, invitations, roles and permissions, organisation
  reference data, assignment and moderation
- **Legal Unit** — legal dashboard, review queue, case work, redaction, templates
  and letter generation, court diary, reports
- **Clerk / Support** — registry work: intake, document upload, scheduling, data
  entry, no determinations
- **Requestor** — the public-facing portal: submit a request, track it against the
  statutory clock, read the response, appeal
- **Auditor** — the same breadth of read access with **every write control absent**
  (not merely disabled); audit trail and access logs
- **External Stakeholder** — external counsel, scoped to assigned litigation

Role scoping is enforced in one place. `src/lib/rbac.ts` holds the permission
catalogue and the seven role definitions; the sidebar, the command palette, the
404 page's suggestions and the route guards all read the same filter, so they
cannot disagree about who sees what. A blocked route renders a **403 explainer in
place** rather than redirecting, so the address bar still shows what was
attempted and the page names the permission you would need.

---

## A five-minute tour

A route worth walking in this order when presenting:

1. **`/login`** — split-screen sign-in with the Coat of Arms, SSO button, MFA step
   and the demo picker. (ToR wireframe 1)
2. **Super-Admin → `/dashboard/system`** — organisation-wide KPIs, SLA compliance,
   request volume trend, system health. (Wireframe 2)
3. **Admin → `/admin/users`** and **`/admin/roles`** — directory with bulk select,
   invitations, and the permission matrix. (Wireframe 3)
4. **Legal → `/dashboard/legal`** — my queue, overdue and due-soon cards, hearings
   this week, workload by officer. (Wireframe 4)
5. **`/cases`** — the case list: colour-coded status, saved views, advanced
   filters, bulk operations, CSV export. (Wireframe 5)
6. **`/cases/case-0042`** — the case file: timeline, documents with version
   history and a preview drawer, internal vs public notes, tasks, linked cases,
   SLA panel, closure. (Wireframe 6)
7. **`/court`** — the court diary in month, week and day views; click a hearing for
   the brief, counsel, reminders and outcome. (Wireframe 7)
8. **`/reports`** then **`/reports/builder`** — predefined statutory reports and
   the drag-free custom builder with grouping, filters and scheduling. (Wireframe 8)
9. **`/search`** — global search across cases, documents, notes and people, with
   type facets and highlighted matches. (Wireframe 9)
10. **Auditor → `/audit`** — the immutable trail, then `/audit/access` for document
    access logs. Note the absence of every write control.

Press <kbd>Ctrl</kbd>+<kbd>K</kbd> anywhere for the command palette. The **New FOI case** button in the
topbar (it reads **New request** for requestors) is the quick-create the ToR asks
for.

---

## Requirement coverage

Where each ToR requirement group lives in the code.

| ToR | Requirement | Where |
| --- | --- | --- |
| FR-001–003 | User accounts, authentication, RBAC | `src/lib/rbac.ts`, `src/store/AuthContext.tsx`, `src/app/guards.tsx`, `/admin/users`, `/admin/roles` |
| FR-004–005 | Profile self-service, MFA, password policy | `/profile`, `/system/settings` |
| FR-006 | Audit of account activity | `/audit` |
| FR-010–013 | Request intake, auto case creation, acknowledgement, assignment | `/requests/new`, `/cases/new`, `/review-queue` |
| FR-014–015 | Response upload and document versioning | case file → Documents tab, `/documents` |
| FR-016–017 | Status updates and SLA timers | `src/lib/sla.ts`, status cards on every dashboard |
| FR-020 | Case dashboard | `/cases` |
| FR-021 | Case detail with timeline | `/cases/:id` → Timeline tab (`src/mocks/data/timeline.ts`) |
| FR-022–023 | Internal notes, mentions, tagging | case file → Notes tab |
| FR-024–025 | Case linking and closure | case file → Linked cases, Close case |
| FR-030–031 | Legal dashboard and review queue | `/dashboard/legal`, `/review-queue` |
| FR-032 | Document redaction | case file → Documents → Redact |
| FR-033 | Templates and letter generation | `/templates` |
| FR-034–036 | Court scheduling, reminders, outcomes | `/court`, `/court/:hearingId` |
| FR-041 | Advanced filters and saved views | `/cases` filter bar and `SavedViewBar` |
| FR-044 | CSV import with column mapping | `/admin/import` |
| FR-045, FR-051 | Bulk operations | `BulkActionBar` on `/cases` and `/admin/users` |
| FR-046 | Exports | `toCsv` in `src/lib/utils.ts`, export buttons on lists and reports |
| FR-050–054 | Reports, builder, schedules | `/reports`, `/reports/builder` |
| FR-060–063 | Notifications, preferences, help | `/notifications`, `/profile` → Notifications, `/help` |
| FR-070–073 | Document store, integrations, access logs | `/documents`, `/admin/integrations`, `/audit/access` |

---

## Project structure

```
src/
  app/          Entry, router, route guards, provider tree
  assets/       Coat of Arms and brand marks
  components/
    ui/         Primitives — buttons, tables, badges, drawers, forms (63 exports)
    charts/     Recharts wrappers with the brand palette
    common/     Page furniture — headers, empty states, filter bars
    layout/     AppShell, Sidebar, Topbar, CommandPalette, NotificationBell
  features/     One folder per module: auth, dashboard, cases, court, documents,
                templates, reports, search, notifications, profile, admin, misc
  hooks/        useAsync, useDebounced
  lib/          rbac, navigation, sla, constants, format, utils
  mocks/        Seeded data generators and the fake API layer
  store/        AuthContext, DataContext, ToastContext
  types/        Shared domain types
scripts/
  smoke.mjs     Import + render smoke test
```

Two files are worth reading first, because everything else follows from them:

- **`src/lib/navigation.ts`** — the single source of truth for navigation. Each
  entry declares its route, icon and required permission. The sidebar, command
  palette and 404 suggestions all render from this array, and every guarded route
  in `src/app/router.tsx` declares the same permission its nav entry declares.
- **`src/lib/rbac.ts`** — the permission catalogue (10 groups) and the seven roles.

Pages are lazy-loaded per feature barrel, so opening the court diary does not
download the report builder.

## What is mocked

There is no backend. The seam a real API would slot into is:

- **`src/mocks/db.ts`** — builds the whole dataset once at module load from
  deterministic seeded generators (`seededRandom`), so every reload shows the same
  96 cases, users, documents, notes, hearings, logs and notifications. Dates are
  relative to today, which keeps SLA states, overdue queues and "hearings this
  week" believable whenever the prototype is opened.
- **`src/mocks/api.ts`**, **`adminApi.ts`**, **`importApi.ts`** — promise-returning
  functions with a small artificial delay, shaped the way the real endpoints should
  be shaped. Replacing these with `fetch` calls is the backend integration.
- **`src/mocks/metrics.ts`** — derives every dashboard figure from the dataset, so
  the numbers on the dashboards always reconcile with the case list.

Consequences a reviewer should know:

- **Writes are in-memory.** Creating a case, adding a note or closing a case updates
  the live dataset and the UI, but a **browser reload resets everything**. Only the
  signed-in session and sidebar state persist (`localStorage`).
- **Uploads are simulated.** File pickers accept a file and record realistic
  metadata — name, size, version, checksum, virus-scan and OCR status — but nothing
  is transmitted or stored. Document previews render a representative page, not
  your file.
- **Nothing is sent.** No email, SMS or webhook leaves the browser; notifications
  are generated locally. Exports (CSV) are produced client-side and do download.
- **Timeline is derived, not seeded** (`src/mocks/data/timeline.ts`) — assembled
  from the records that already exist on a case, so it can never contradict them.

---

## Accessibility and responsiveness

Built towards the WCAG 2.1 AA target the ToR sets. What is in place:

- A skip link to `#main-content`, semantic landmarks, and one `h1` per page
  (rendered by `PageHeader`, so it cannot be forgotten)
- Every interactive control is keyboard reachable with a visible focus ring.
  Modals move focus into the dialog on open; modals, drawers and dropdowns close
  on <kbd>Esc</kbd> and lock background scroll
- Status is never carried by colour alone — every status badge pairs its colour
  with a dot and a text label, and icons that carry no meaning are `aria-hidden`
- Form controls go through one `Field` scaffold: real `<label htmlFor>`,
  `aria-invalid` on error, and `aria-describedby` pointing at the hint or the
  error message, which is announced with `role="alert"`
- Tables use `scope="col"` headers, and bulk-select checkboxes carry per-row
  accessible names
- Toasts and loading states announce through `aria-live`
- Brand green `#008751` on white clears 4.5:1, and the green panels — the
  navigation rail and the sign-in canvas — sit at `brand-600` (`#007546`) where
  white text reaches 5.8:1 and the `brand-50`/`brand-100` supporting copy 4.7:1
  or better. The palette in `tailwind.config.js` was chosen for contrast as well
  as for looks

Not yet done, and worth knowing before an accessibility review: dialogs move focus
in but do not yet cycle <kbd>Tab</kbd> within themselves, and no assistive-technology
pass has been run — only keyboard and contrast checks.

Layout is responsive from 360 px up, and the chrome owns the viewport: the shell is
exactly one screen tall, so the navigation rail and the utility bar never scroll
away and `#main-content` is the only thing that moves. The rail collapses to
centred icons from the topbar toggle — each one labelled by a tooltip that escapes
its scroll container — and becomes a slide-in sheet below `lg`.

Tables scroll inside their own box in both directions, with the column headers
pinned to the top of that box. However long a register is, the header row, the tab
strip and the bulk-action bar stay where you can reach them. The court diary offers
day and week views for narrow screens where the month grid is too dense.

## Verification

Three checks run clean on the committed tree:

```bash
npm run typecheck   # tsc --noEmit, strict, with noUnusedLocals/noUnusedParameters
npm run smoke       # 26 modules load; all public screens server-render
npm run build       # production bundle, code-split per feature
```

`npm run verify` runs all three in order.

## Notes for the backend phase

Things deliberately left for the real implementation, so they are not mistaken for
gaps:

- **Authentication** is simulated. Any password of 4+ characters signs you in and
  the MFA code is fixed at `123456`. Real sign-in, token refresh, session
  revocation and password rotation belong to the backend; the frontend already has
  the states for each (MFA challenge, suspended, invited, expired session).
- **SSO** returns a fixed staff account. The Entra ID redirect, claim mapping and
  group-to-role mapping are backend concerns; `/admin/integrations` shows where the
  configuration surfaces.
- **Server-side pagination, sorting and search.** Lists currently filter the
  in-memory dataset. `listCases` already takes the shape of a paged query, so the
  swap is contained.
- **Redaction** records severances and their statutory grounds against a document,
  but burning redactions into a PDF must happen server-side so the original is
  never shipped to the client.
- **Notifications** are generated locally. Email, SMS and webhook delivery, plus the
  quiet-hours and digest scheduling shown in `/profile`, need a job runner.
- **Audit trail immutability.** The UI treats the trail as append-only; enforcement
  (write-once storage, hash chaining) is a backend guarantee.
- **File storage, virus scanning and OCR** are represented by status fields only.

---

*Prototype for review. Not a live system — no real FOI request is received,
processed or answered here.*
