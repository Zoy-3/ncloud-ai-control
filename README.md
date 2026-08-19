# NCloud AI Control

NCloud AI Control is the central web application for the future NCloud Flatsome AI
system. The current application provides a dashboard, health API, and local library of
reusable Flatsome UX Builder sample layouts. Phase 2 adds a verified Supabase job queue,
authenticated local runner APIs, a controlled development setup, and an internal jobs
dashboard. The runner returns fixed test shortcode only; AI generation and WordPress are
not connected yet.

## Requirements

- Node.js 20.19 or newer (Node 22 or 24 LTS is also suitable)
- npm

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open `http://localhost:3000` for the dashboard or
`http://localhost:3000/dashboard/sections` for the section library. The internal job
queue is available at `http://localhost:3000/dashboard/jobs` in development.

## Supabase environment

The control app reads Supabase credentials from `.env.local`. That file is ignored by
Git. `.env.example` documents the required names without containing credentials:

- `NEXT_PUBLIC_SUPABASE_URL` is the Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the new client-safe publishable key. It is
  reserved for browser access that may be added later; Row Level Security must still
  protect any browser-accessible data.
- `SUPABASE_SECRET_KEY` is the new elevated server credential. It is read only through
  server-only modules and must never be imported into a Client Component, exposed to
  browser JavaScript, logged, returned by an API, or committed.
- `DEV_API_SECRET` protects development-only API operations.

The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` environment
variables are not used. Server-side Supabase access is initialized with session
persistence, token refresh, and URL session detection disabled.

The `service_role` name inside the SQL migration refers to Supabase's PostgreSQL role
for elevated database grants. It is not an environment-variable requirement; the
control app authenticates with `SUPABASE_SECRET_KEY`.

## Production deployment variables

A hosted deployment (Vercel later) needs exactly these variables. Set them in the
hosting provider's project settings. Never create a committed `.env.production`, and
never place a real secret in `.env.example`.

Required in production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` — server-only; read only through modules that import
  `server-only`, and never exposed to the browser or returned by an API.

Development only:

- `DEV_API_SECRET` — required when `NODE_ENV=development` and intentionally unset in
  production. Every `/api/dev/*` route returns 404 outside development, so a hosted
  deployment needs no development credential.

The plugin-facing production routes are `GET /api/wordpress/status`,
`GET /api/wordpress/sections`, and `GET /api/wordpress/sections/:id`. All three are
dynamic, send `Cache-Control: no-store`, and authenticate with the site bearer token.
No development-only route is part of that flow.

The WordPress plugin calls these routes from its own server, so no browser CORS
configuration is required. Note that production visibility hides drafts: until sections
are published, a hosted template listing is correctly empty.

## Verified Phase 2 schema

The Phase 2 schema is defined in
[`supabase/migrations/20260818000000_phase2_job_queue.sql`](supabase/migrations/20260818000000_phase2_job_queue.sql).
The runner RPC reconciliation is defined in
[`supabase/migrations/20260818001000_reconcile_phase2_functions.sql`](supabase/migrations/20260818001000_reconcile_phase2_functions.sql).
Both migrations are already applied to the existing project. The corrected catalog
verification in [`supabase/verification/verify_phase2_schema.sql`](supabase/verification/verify_phase2_schema.sql)
passes all 76 checks with zero failures.

Do not rerun the original migration. Any future database change must be a new additive
migration that preserves the existing tables and data.

## Controlled development setup

After the verified schema and local environment variables are available, run:

```bash
npm run setup:phase2
```

The script configures exactly one site (`NCloud Development Site` at
`ncloud-development.local`) and one runner (`ncloud-office-pc`). It generates a random
256-bit runner token, stores only its SHA-256 hash in Supabase, and writes the raw token
without printing it to the ignored file:

```text
C:\Users\Dell\Documents\Flatsome ai\ncloud-ai-runner\.env
```

The required line is `RUNNER_TOKEN=<generated-43-character-token>`. The setup refuses to
rotate an existing mismatched, disabled, or busy runner automatically.

## Production build

```bash
npm run lint
npm run build
npm start
```

The project is structured for a future Vercel deployment, but it is not linked to or
deployed on Vercel in this phase.

## Local APIs

- `GET /api/health` returns the control service status and a dynamically generated ISO
  timestamp.
- `GET /api/sections` returns the four local sample sections.
- `GET /api/sections?category=corporate` filters the library by a case-insensitive
  category slug. The other current slugs are `tourism`, `hotel`, and `ecommerce`.
- `POST /api/runner/heartbeat` authenticates the configured runner and records its
  current heartbeat.
- `POST /api/runner/jobs/claim` atomically claims at most one oldest pending job through
  the verified PostgreSQL RPC.
- `POST /api/runner/jobs/:id/complete` completes an owned processing job with shortcode.
- `POST /api/runner/jobs/:id/fail` fails an owned processing job with a readable error.
- `POST /api/dev/jobs` creates a pending job for the controlled development site.
- `GET /api/jobs/:id` returns the minimal development job status and result.
- `POST /api/dev/sites/site-token` generates a new raw site token for one existing site,
  identified by `{"siteId":"<uuid>"}` or `{"domain":"<exact-domain>"}`. It stores only
  the SHA-256 hash in `sites.site_token_hash`, writes no other column, and returns the
  raw token exactly once in the response.
- `GET /api/dev/wordpress/auth-check` proves site bearer authentication works and
  returns only the authenticated site's id, name, domain, and status.
- `GET /api/wordpress/status` is the plugin's connection check. It works in every
  environment and returns the authenticated site, the control service state, and an
  advisory runner state of `online`, `offline`, or `unknown`.
- `GET /api/wordpress/sections` returns the Supabase-backed template library as metadata
  only, without shortcode.
- `GET /api/wordpress/sections/:id` returns one template including its stored Flatsome
  shortcode.

Runner routes require `Authorization: Bearer <RUNNER_TOKEN>`. The raw runner token is
SHA-256 hashed before lookup and is never logged or stored in Supabase. Development job
creation and status routes require the `x-dev-api-secret` header and deliberately return
404 outside `NODE_ENV=development`. All Phase 2 API responses disable HTTP caching.

## WordPress site authentication

Future WordPress plugin requests authenticate with `Authorization: Bearer <SITE_TOKEN>`.
Site tokens use the same convention as runner tokens: 256 random bits encoded as 43
base64url characters, stored only as a SHA-256 hash. The server hashes the presented
token, looks up the matching site, and requires `status = active`; the authenticated
identity always comes from the stored row, so a caller can never assert which site it
is. A missing header, a non-Bearer scheme, a malformed token, and an unknown token all
produce the same `401` response, while a disabled site produces `403`.

Raw site tokens exist only in the provisioning response. They are never stored in the
database, written to a tracked file, logged, or returned by any other route. Both
routes above return 404 outside `NODE_ENV=development`, and provisioning additionally
requires the `x-dev-api-secret` header, so there is no unauthenticated way to mint a
token.

## Phase 2 validation

```bash
npm run test:backend
npm run lint
npm run build
```

The backend tests cover token generation and hashing, strict bearer parsing, request
contracts and limits, response mapping, no-store responses, and safe runner `.env`
updates. Live validation must use `npm run dev`, because the temporary development APIs
are intentionally unavailable under `next start`.

## WordPress template API

`GET /api/wordpress/sections` and `GET /api/wordpress/sections/:id` are the real
plugin-facing endpoints. They read the existing Supabase `sections` table, require
`Authorization: Bearer <SITE_TOKEN>`, and disable HTTP caching. Listings return metadata
only — `id`, `name`, `category`, `sectionType`, `style`, `previewScreenshotUrl`, and
`status` — so the stored shortcode travels only in a detail response, which the plugin
requests once the user picks a template.

Visibility follows the environment: development exposes `draft` and `published` records
so the current unscreenshotted development sections are usable, while every other
environment exposes `published` only. `archived` is never returned. A section that does
not exist and a section the environment may not see produce the same `404`, so hidden
records are never revealed. Phase 2B has no pagination, search, filtering, or
site-specific saved sections; the reads are bounded instead.

The separate `GET /api/sections` route remains an in-memory sample used by the internal
dashboard. It is not the WordPress API and does not read Supabase.

## Two section libraries

The project keeps two deliberately separate tables, and they must not be merged:

| Table | Meaning | Visibility |
| --- | --- | --- |
| `sections` | The central NCloud template library, curated by NCloud. | Shared by every authenticated site, filtered by `status`. |
| `saved_sections` | A site's own **My Saved** library. | Owned by exactly one site and never visible to another. |
| `site_hidden_sections` | A site's visibility preference over central templates. | Site-local; hiding never deletes a template or affects another site. |

Keeping them apart means a tenant row can never be reached by a query written against
the global library, and the two can evolve independently.

## WordPress My Saved API

`GET /api/wordpress/saved-sections`, `GET /api/wordpress/saved-sections/:id`, and
`POST /api/wordpress/saved-sections` are the plugin-facing endpoints for a site's own
library. All three use the same `Authorization: Bearer <SITE_TOKEN>` authentication as
the template API and disable HTTP caching.

Ownership always comes from the bearer token. A request body may not name a site: the
create schema is `.strict()`, so a body carrying `siteId`, `site_id`, or a preview path
is rejected rather than ignored. Every read and the insert are filtered by `site_id`,
and the row a detail read returns is re-checked against the authenticated site before it
is mapped. A saved section that does not exist and one owned by another site produce the
same `404`, so another site's records can never be probed for.

Listings are metadata only — `id`, `name`, `previewScreenshotUrl`, `createdAt`, and
`updatedAt`, newest first — so stored shortcode and CSS travel only in a detail response.
`site_id` is never part of any response.

`preview_storage_path` holds an object path inside the public `section-previews` Storage
bucket, never image bytes, and the public URL is built by the Supabase client from the
configured project URL rather than a hostname written into this repository. A null path
yields a null `previewScreenshotUrl`. Uploads are a later phase, so a newly created row
always stores `preview_storage_path = null`.

Stored shortcode and CSS are validated for type, emptiness, and length only. Neither is
trimmed, sanitised, escaped, or normalised: both are verbatim payloads whose own
whitespace is meaningful.

## Sample section library

The library contains one published About layout for each of the four initial website
categories: Corporate, Tourism, Hotel, and E-commerce. Its SVG files are development
thumbnails only. The stored mock shortcodes contain no real image URLs, WordPress
attachment IDs, media IDs, or image-replacement tokens.

An empty `[ux_image]` element indicates only where an image-like UX Builder element is
intended. It is not being treated as verified production Flatsome syntax. Exact image and
image-box syntax must be captured from the installed Flatsome version before production
generation is designed.

## Future section saving workflow

```text
AI Generates Section
        ↓
Insert Into UX Builder
        ↓
User Tests / Edits Section
        ↓
Save to Library
        ↓
Ask for Section Screenshot
        ↓
Enter Metadata
        ↓
Validate
        ↓
Publish
```

Published sections will eventually require a name, category, section type, Flatsome
shortcode, and screenshot. Generated sections should automatically retain their original
prompt and generated shortcode, so users never need to copy and paste shortcode.

Screenshot publishing rules:

- Draft: screenshot optional.
- Published: screenshot required.
- Archived: hidden.

A generated layout without a screenshot may be saved as a draft, but it must not appear
in the normal UX Builder section library. These rules are documentation only; no database
validation is implemented yet.

## Architecture documentation

- [Revised architecture, V1 direction, and phase roadmap](docs/architecture.md)
- [Flatsome schema capture plan](docs/flatsome-schema.md)

## Remaining Phase 2 limitations

- Codex CLI and AI generation are not connected.
- WordPress authentication and communication are not connected.
- Flatsome UX Builder insertion is not implemented.
- The internal dashboard and development APIs do not yet have production user auth.

## Central template management

`/admin/templates` is the NCloud-side manager for the shared library. It lists
every template in every status, creates and edits them, changes status between
Draft, Published, and Archived, and uploads preview images.

Access is a dedicated administrator boundary. WordPress site tokens are not
accepted, and Supabase credentials are never used as a password:

- `POST /api/admin/session` takes the secret in a JSON body — never a URL or a
  query string — compares it in constant time, and returns an **HttpOnly**,
  `SameSite=Lax` cookie that is `Secure` outside development. The cookie holds a
  signed expiry, not the secret.
- `DELETE /api/admin/session` signs out.
- Every `/api/admin/*` route re-checks the session server-side on each request.

The secret comes from **`NCLOUD_ADMIN_SECRET`** (minimum 16 characters). It is
optional: while it is unset the manager reports itself switched off and every
admin route refuses to operate, so an unconfigured deployment exposes nothing.
A missing secret and a wrong secret fail identically.

## Template visibility and previews

A WordPress site can **hide** a central template from its own library but can
never delete one. `POST` and `DELETE /api/wordpress/sections/{id}/hide` record
and remove that preference, scoped to the site resolved from the bearer token.
`GET /api/wordpress/sections` excludes hidden templates;
`?includeHidden=1` returns them carrying `hidden: true` so one can be restored.

Preview images live in the public-read `section-previews` bucket. Every write
and delete goes through this app with the server-side secret key; the browser
and WordPress never receive Storage credentials. Paths are generated on the
server — `saved/{site_id}/{saved_section_id}/{uuid}.{ext}` and
`templates/{section_id}/{uuid}.{ext}` — so a caller can neither name an object
nor reach another site's. Uploads accept JPEG, PNG, and WebP up to 5 MB; SVG is
refused because it can carry script and the bucket is world-readable.

`sections.preview_storage_path` is preferred when set, with the older
`preview_screenshot_url` kept as the fallback for existing records.

## Migration order

Run these in Supabase in this order; each is additive and safely re-runnable:

1. `20260819000000_add_section_css_code.sql`
2. `20260819001000_saved_sections.sql`
3. `20260819002000_site_hidden_sections.sql` — requires `sites` and `sections`
4. `20260819003000_section_preview_storage_path.sql`

Deploy order: run the migrations first, then deploy the app. Routes that select
new columns return `503 database_unavailable` until their migration has run.

## Dashboard navigation

The sidebar reaches every area directly, so no admin URL has to be typed:

Dashboard · Sites · Sections · Saved Sections · Template Manager · Categories ·
Jobs · Runner · Settings

**Sections** is the shared NCloud library; **Saved Sections** is central inspection
of site-owned `saved_sections`. The two are never merged. **Template Manager**
(`/admin/templates`) is the create/edit workspace. Runner and Settings are still
placeholders.

Administrator pages are wrapped by a server-rendered gate: an unauthenticated
visitor is never sent the page contents, only the sign-in form. Signing in
re-renders the page that was originally requested, so no redirect target ever
travels in a URL. Every admin page carries **Back to dashboard** and **Sign Out**;
signing out calls `DELETE /api/admin/session`, which clears the HttpOnly cookie.

## Route classification

| Class | Routes | Guard |
| --- | --- | --- |
| Public health | `GET /api/health` | none; returns no data about the system |
| Site authenticated | `/api/wordpress/*` | `Authorization: Bearer <SITE_TOKEN>`, tenant-scoped |
| Admin authenticated | `/api/admin/*` | `requireAdminSession()` |
| Development only | `/api/dev/*` | 404 unless `NODE_ENV=development` |

`/api/dev/*` routes call `assertDevelopmentEnvironment()` first, which throws a
plain 404 outside development, so a hosted deployment does not reveal that they
exist. `DEV_API_SECRET` is intentionally unset in production and is never
returned by any route.

## Typography

The UI face is **Inter Tight**, loaded with `next/font/google` (`Inter_Tight`),
which self-hosts the files, preloads them, and emits `size-adjust` fallback
metrics so no layout shift occurs. Only the weights in use (400/500/600/700) are
requested. The family is exposed as `--font-inter-tight` and consumed through the
existing `--font-sans` token, so there is one global font definition and a
sensible sans-serif fallback if the face never loads. Code areas — shortcode and
CSS textareas — remain monospace.

## Request limits and abuse protection

Bounded sizes are enforced from shared constants rather than repeated literals:
`requestBodyLimits`, `savedSectionLimits`, `templateLimits`, and
`MAX_PREVIEW_BYTES`. Shortcode ≤ 200,000 characters, CSS ≤ 100,000, preview
images ≤ 5 MB (checked against the declared size *and* the real byte length),
sign-in bodies ≤ 1,000 bytes.

No request-rate limiter is implemented. Vercel functions are per-instance, so an
in-memory counter would give a false guarantee while providing no real protection
across instances. **Distributed rate limiting is a documented future production
enhancement** and should be added at the edge or with a shared store before
opening the admin login to the public internet.

## Signing in

The whole application is behind an administrator account. `/login` takes a
username and password; `/dashboard/*` and `/admin/*` are wrapped by server-side
layouts that redirect an unauthenticated visitor, so protection never depends on
anything the browser chooses to run. `/` resolves the session and redirects to
`/dashboard`, `/login`, or `/change-password` without rendering anything first.

**First setup.** While `admin_users` is empty, `/login` accepts
`NCLOUD_BOOTSTRAP_USERNAME` and `NCLOUD_BOOTSTRAP_PASSWORD`. A successful match
creates the account, stores only a hash of that password, marks it
`must_change_password`, and sends the user to `/change-password`. The moment an
account exists the bootstrap variables are never consulted again, so a temporary
password can never become a permanent back door. Until the password is changed,
every other page redirects back to `/change-password`.

**Passwords** are stored as `scrypt$v1$N,r,p$salt$key` (N=16384, r=8, p=1, random
16-byte salt, 64-byte key), compared in constant time. Parameters travel with
each hash so they can be raised later without a migration. Minimum 12
characters, maximum 128. A plaintext password is never stored, logged, or
returned.

**Sessions** carry `<userId>.<expiry>.<HMAC>` in an HttpOnly, `SameSite=Lax`
cookie that is `Secure` in production, valid 8 hours. Every protected request
re-reads the account, so disabling it takes effect immediately. Changing a
password issues a fresh cookie. `NCLOUD_ADMIN_SECRET` is now purely the
**session signing secret** — it is nobody's password, is never sent to the
browser, and is never stored in the database. Rotating it signs everyone out.

**Login throttling** is shared state in Postgres, not process memory: five
failures inside fifteen minutes block that identity for fifteen minutes, and a
success clears it. The identity is the normalized username keyed-hashed with the
server secret — no plaintext username, no address, nothing reversible. A client
address is deliberately *not* used: on a serverless platform the only source is a
forwarded header an attacker can vary freely, so throttling by it would look
like protection while providing none. The accepted trade-off is that someone who
knows the username can hold it blocked in fifteen-minute stretches. The counter
is one row per identity, overwritten in place, with stale rows removed
opportunistically, so the table cannot grow without bound and no scheduled job is
needed.

There is no password reset. Recovery is a manual administrative procedure:
delete the `admin_users` row directly in Supabase and sign in again with the
bootstrap credentials.

## Connecting a WordPress site

1. **Sites → Add Site** with a name and domain. The new site has no usable token.
2. **Generate / Rotate Token.** The raw token appears once, in that response
   only. Copy it — it is never stored, logged, or retrievable again.
3. In WordPress, **Settings → NCloud AI**: paste the Control API URL and the
   token, save, then **Test Connection**.

Each site uses its own token; never reuse one across sites. Rotating replaces the
stored hash, so the previous token stops working immediately and that site is
disconnected until the new token is saved. Disabling a site keeps everything it
owns — saved sections, hidden-template preferences, previews — and only makes
`/api/wordpress/*` fail authentication; enabling it restores access with the same
token unless it was rotated.

## Environment variables

| Variable | Role |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client-safe publishable key |
| `SUPABASE_SECRET_KEY` | server-only database credential |
| `NCLOUD_ADMIN_SECRET` | **session signing secret** (no longer a password) |
| `NCLOUD_BOOTSTRAP_USERNAME` | one-time initial administrator username |
| `NCLOUD_BOOTSTRAP_PASSWORD` | one-time initial temporary password, 16+ chars |
| `DEV_API_SECRET` | development only; unset in production |

Set the bootstrap password manually in the hosting provider. It is never
committed, never printed, never returned by an API, and never shown in Settings.

## Migration order

Run in Supabase in this order; each is additive and safely re-runnable:

1. `20260819000000_add_section_css_code.sql`
2. `20260819001000_saved_sections.sql`
3. `20260819002000_site_hidden_sections.sql`
4. `20260819003000_section_preview_storage_path.sql`
5. `20260819004000_admin_users.sql`
6. `20260819005000_admin_login_attempts.sql`

Migrations first, then deploy. Routes that select new columns return
`503 database_unavailable` until their migration has run.

## One library, three views

Dashboard → Sections, Template Manager, and the WordPress Templates tab are all
views of the same `sections` rows. Nothing in the dashboard renders sample data.

| View | Reads | Shows |
| --- | --- | --- |
| Dashboard → Sections | `listAdminTemplates()` | every status — it is an administrator view |
| Template Manager | `listAdminTemplates()` | every status, plus create and edit |
| WordPress Templates | `listWordPressSections()` | published only, minus that site's hidden ones |

`src/data/sample-sections.ts` and `src/data/site-categories.ts` are **demo
fixtures**, labelled as such at the top of each file. They belong to the
in-memory `GET /api/sections` demonstration route and must never again power a
page that represents the real library — doing so is exactly what made Sections
display four templates that did not exist in the database.

**Categories** are derived from `sections.category`, never hard-coded. Two
values are the same category only when they differ by surrounding whitespace or
letter case; the first spelling encountered is kept and displayed unchanged.
Names that differ any other way — "Ecommerce" and "E-commerce" — stay separate
rather than being silently merged. `src/lib/sections/categories.ts` is the single
place that decides this, shared by the Sections filters, the Template Manager
dropdown, and the Categories page. Creating a template with a new category makes
it available everywhere immediately, and to WordPress once a template using it is
published.
