# SITEPM

AI Operating Layer for Construction. This repository is the contractor MVP.

## Run locally

Requires Node.js 24+ (`node --version`) and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Server-only Ask Stage 3 uses `OPENAI_API_KEY` in `.env.local` (never `NEXT_PUBLIC_*`). Optional: `OPENAI_MODEL` (defaults to `gpt-4o-mini`).

## Current phase

Projects, Tasks, Field Logs, Documents, and Ask SITEPM V1 Stages 1–2 are accepted. Ask Stage 3 adds a replaceable, server-only model over that project-scoped evidence. **Ask Stage 4 (PDF intelligence) has not started.**

Canonical product architecture (Digital Toolbag + AI Project Manager + Construction OS; architecture breadth ≠ MVP): `docs/PRODUCT_ARCHITECTURE.md`. MVP sequence: `SITEPM_BUILD_SPEC.md`.
