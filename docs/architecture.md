# NCloud Flatsome AI architecture

This document describes the revised product direction and the phase roadmap that
future development must follow. It replaces the earlier assumption that the WordPress
plugin would drive Flatsome UX Builder directly.

## V1 product direction

The WordPress plugin works primarily on the WordPress **UX Block edit screen**. A
floating NCloud AI button opens a panel with three areas:

- **Create with AI** — describe a section and generate it (Phase 6).
- **Templates** — browse the NCloud template library (Phase 4).
- **My Saved** — reuse sections saved from this site (Phase 5).

**V1 does not manipulate Flatsome UX Builder internals.** Templates and AI results are
returned as valid Flatsome shortcode, and the plugin inserts that shortcode into the
existing WordPress UX Block **Code editor**. Everything after insertion uses normal
WordPress and Flatsome behavior.

```text
NCloud floating button
  ↓
choose a template or generate with AI
  ↓
receive valid Flatsome shortcode
  ↓
insert shortcode into the UX Block Code editor
  ↓
user clicks the normal WordPress Update button
  ↓
user opens Flatsome UX Builder and edits the resulting elements normally
```

This keeps the integration surface small: NCloud produces shortcode text, and Flatsome
remains the only thing that interprets it.

## Repository responsibilities

The system is three independent repositories and that split is being kept.

### ncloud-ai-control

Next.js control application and API; later hosted on Vercel.

- Communicates with Supabase (server-side only, with the secret key).
- Authenticates WordPress sites and local runners.
- Provides the section/template library to the plugin.
- Creates generation jobs and exposes their status and results.
- Hosts the internal dashboard.

### ncloud-ai-flatsome

WordPress plugin, installed at `wp-content/plugins/ncloud-ai-flatsome/`.

- Adds the floating NCloud interface to the UX Block edit screen.
- Browses templates from the Control API.
- Inserts returned shortcode into the UX Block Code editor.
- Later supports My Saved and Create with AI.
- Talks only to the Control API, using its own site token.

### ncloud-ai-runner

Local worker on the user's Windows PC.

- Polls the Control API and claims one generation job at a time.
- Runs the locally authenticated Codex CLI.
- Validates and serializes generated Flatsome shortcode before returning it.
- Returns results through the Control API.
- Makes outbound connections only; it never accepts inbound internet connections.

## Full system direction

```text
Flatsome UX Block edit screen
        ↓
NCloud WordPress plugin
        ↓
NCloud Control API (Next.js / Vercel)
        ↓
Supabase (sites, runners, jobs, sections)
        ↓
NCloud local runner
        ↓
Codex CLI
        ↓
validated Flatsome shortcode
        ↓
Control API
        ↓
WordPress plugin
        ↓
UX Block Code editor
```

A user must never need to copy and paste shortcode manually between the control
application and WordPress.

## V1 rules

These rules constrain every future phase.

- **WordPress never talks to Supabase directly.** The plugin calls the Control API and
  authenticates with its own site token. Supabase service credentials stay on the
  server and are never shipped to WordPress or a browser.
- **The local runner is outbound-only.** It polls the Control API. The public internet
  does not call the runner, and the runner exposes no inbound endpoint.
- **Screenshots are preview thumbnails only.** A template screenshot is separate from
  the stored Flatsome shortcode and is never a source of layout data.
- **Existing editor content is never silently overwritten.** When insertion is
  implemented, the user must stay in control of what happens to content already in the
  Code editor.
- **Templates cover two sources.** The library must eventually serve both NCloud global
  templates and site-specific saved sections.
- **The Flatsome schema is captured, never guessed.** See
  [Flatsome schema capture plan](flatsome-schema.md).

## Phase roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Stabilize the existing project and documentation | Complete |
| 2 | Site-token provisioning/authentication and the real Supabase-backed WordPress Template API | Not started |
| 3 | Deploy the Control application and verify hosted WordPress ↔ Control API connectivity | Not started |
| 4 | WordPress floating NCloud panel, Templates browser, and shortcode insertion into the UX Block Code editor | Not started |
| 5 | My Saved library: saving current shortcode, preview screenshot upload, reusable site-specific sections | Not started |
| 6 | Fix the Codex CLI real-execution blocker and connect Create with AI through the existing job/runner architecture | Not started |
| 7 | Production hardening, security, compatibility, and release testing | Not started |

Work already completed before this roadmap was written: the control application,
dashboard, and sample library; the Supabase job queue with authenticated runner APIs;
the runner's provisional Flatsome schema, validator, and serializer; and the runner's
Codex CLI boundary with mocked tests.

## Section resolution paths

These paths describe Phase 6 behavior. No section router is implemented.

### 1. Exact library match

```text
Prompt
  ↓
Find existing section
  ↓
Return stored Flatsome layout
  ↓
No Codex generation
```

### 2. Existing layout + AI modification

```text
Prompt
  ↓
Find close section
  ↓
Codex modifies section
  ↓
Return updated layout
```

### 3. New AI generation

```text
Prompt
  ↓
No suitable template
  ↓
Codex generates new Flatsome layout
```

## Known blockers

- **Codex CLI real execution (Phase 6).** The runner's Codex boundary passes its mocked
  and fixture tests, but the one approved real-generation smoke test failed: the CLI
  exited with status 1 and empty stdout before producing any model output, so the
  parse, validation, and serialization stages were never reached. The executor
  deliberately discards child stderr, so the cause is not yet observable. This is not
  being diagnosed before Phase 6.
- **Site-token provisioning (Phase 2).** The development site row stores a hash of a
  token that was generated and then discarded, so no usable raw site token exists yet.
  The WordPress plugin cannot authenticate to any site-scoped Control API route until
  Phase 2 adds a provisioning path.
- **Provisional Flatsome schema.** No schema entry is `locally-verified` yet. Exact
  shortcode syntax must be captured from the installed Flatsome version before
  production generation.

## Database changes

The existing Supabase project and its `sites`, `runners`, `jobs`, and `sections` tables
must be preserved. Future database work uses new additive migrations only. The original
migration must never be rerun.
