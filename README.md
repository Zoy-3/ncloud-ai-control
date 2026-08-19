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
