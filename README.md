# NCloud AI Control

NCloud AI Control is the central web application for the future NCloud Flatsome AI
system. This first phase provides a dashboard, health API, and local library of reusable
Flatsome UX Builder sample layouts. It does not yet include authentication, a database,
AI generation, a job queue, or a WordPress connection.

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
`http://localhost:3000/dashboard/sections` for the section library.

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

- [Future system and section routing](docs/architecture.md)
- [Flatsome schema capture plan](docs/flatsome-schema.md)
