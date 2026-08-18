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
