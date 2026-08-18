# Future NCloud architecture

This document records the intended direction only. None of the AI routing, job queue,
remote insertion, or storage behavior described here is implemented in phase one.

## Section resolution paths

### 1. Exact Library Match

```text
Prompt
  ↓
Find existing section
  ↓
Return stored Flatsome layout
  ↓
No Codex generation
```

### 2. Existing Layout + AI Modification

```text
Prompt
  ↓
Find close section
  ↓
Codex modifies section
  ↓
Return updated layout
```

### 3. New AI Generation

```text
Prompt
  ↓
No suitable template
  ↓
Codex generates new Flatsome layout
```

No section router is implemented yet.

## Full system direction

```text
Flatsome UX Builder
        ↓
NCloud WordPress Plugin
        ↓
NCloud Control API
        ↓
Vercel / Next.js
        ↓
Job Queue
        ↓
NCloud Local Runner
        ↓
Codex CLI
        ↓
Flatsome Layout Code
        ↓
Control API
        ↓
WordPress Plugin
        ↓
Editable UX Builder Section
```

The final workflow must transport generated shortcode automatically. A user should never
need to manually copy and paste it between the control application and WordPress.
