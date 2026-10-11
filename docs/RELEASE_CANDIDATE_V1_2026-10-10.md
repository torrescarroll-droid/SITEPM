# V1 integration candidate — 2026-10-10

Branch: codex/release-sprints-3-6. Isolated worktree: /Users/romulotorres/.codex/worktrees/release-sprints-3-6/SITEPM.

## Composition and conflict resolution

Base HEAD is Sprint 6 61fd8fcc49046aea77601100905daa0ec72abe42, containing Sprint 5 5f3403a65ef4fd3090684682d8e65c5819c30b37, Sprint 4 870f9a269934e03bc3f7abdc6775bc679b72b6ee and original Sprint 3 44e5bda04049736e567826b3793ba81025fe6763. The uncommitted local merge's MERGE_HEAD is Sprint 3 receipt correction 229f3af9d68ca6de973fa6426b608ec54245b004. No merge commit was created. B1's accepted uncommitted client/helper/test files were copied byte-for-byte from /private/tmp/sitepm-sprint6.

The sole merge conflict was package.json: Sprint 3 added the receipt test adjacent to the scripts expanded by Sprints 4/5. Resolution retains all Sprint 6/B1 scripts and adds test:field-receipts:db. No dependency version, product behavior, SQL implementation or security boundary changed. No unresolved conflict remains.

GitHub PR #4 currently reports unmergeable against the advanced Sprint 3 branch. This local integration resolves the mechanical collision; it does not update PRs or remote branches. PR #5 and #6 remain draft. Their signoff and eventual publication/retargeting remain separate release actions.

## Exact migration order

The five SQL files match approved source bytes. supabase/release-sprints-3-6.json records their SHA-256 checksums and required execution order:

1. 20261008054310_field_report_atomic_save.sql
2. 20261009214540_field_report_receipt_integrity.sql
3. 20261008163441_construction_scheduling.sql
4. 20261008201434_scheduling_integrity_boundary.sql
5. 20261009010546_document_management.sql

This manifest is preparation metadata, not an executable migration runner. Filename sorting is not the staged release order. Keep original Sprint 3 plus receipt hardening under one continuous write pause; both scheduling migrations likewise form one cutover boundary. Existing explicit allowlist/timeouts/postflight requirements still apply. No migration was executed in this session.

## Verification performed on this candidate

PASS: document environment/format/transport/action tests; scheduling action/calendar tests; field reliability action/draft tests; operational lookahead/actions; core-job schema/unit; job-desk; Ask Stage 3; lexical retrieval; extractor Stage 4F-C unit suite; focused TLS certificate/hostname tests including both actual client modules.

PASS: ESLint (one pre-existing unused tokenize warning), supported webpack production build using the existing guarded loopback configuration, and build-time TypeScript. Initial standalone TypeScript before route type generation reported missing LayoutProps; the production build generates these types without a source workaround. Final standalone TypeScript is checked after that build.

PASS: no unresolved conflicts; migration checksum/source equality; full receipt correction source equality except deliberately combined package scripts; B1 source equality; prior sprint ancestry; original commissioning document SHA-256 unchanged; whitespace checks.

Existing middleware deprecation and Next Edge-runtime process.cwd build warnings remain; compilation, route generation and build exit succeeded. Dependencies were reused through a node_modules symlink; no dependency changes or installation were needed.

## Limits and preservation

No new browser session, live database acceptance, replay or migration was run. Prior isolated receipt/Sprint 3–6 compatibility evidence remains historical acceptance; it is not represented as a new run. V2 recovered-baseline rehearsal, production configuration, pause/cutover and authorization remain separate gates.

Original sprint worktrees, pending product/release documents and PROGRESS.md changes were not imported or overwritten. Commissioning remains at its original location. The candidate has a new appended progress entry, not staged for publication. No production access, credential changes, deployment, commit, push or PR merge occurred.

Next action: review the candidate and ordered manifest; authorize a local integration commit if accepted, excluding PROGRESS.md unless separately approved. The current candidate intentionally remains an uncommitted merge with B1 working-tree additions.
