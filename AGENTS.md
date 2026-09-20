<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SITEPM project rules

## Progress Tracking Rule

After completing any meaningful SITEPM milestone or build session, update `PROGRESS.md` with:

- Done
- Next
- Blocked

Never delete or overwrite previous progress entries. Append new entries chronologically.

Do not commit or push `PROGRESS.md` automatically. Stop and let the user review the update first.

## Long-term architecture

SITEPM is construction data and operating infrastructure. Models are replaceable. Do not implement future product lines from `docs/PRODUCT_ARCHITECTURE.md` (Property schema, document intelligence, construction/regulatory corpora, bilingual engines) unless the current milestone calls for them. Preserve authentication, company-scoped RLS, and tenant isolation. See `.cursor/rules/sitepm-long-term-architecture.mdc`.
