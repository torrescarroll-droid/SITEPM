# Sprint 3 — Field data reliability

Baseline: `origin/main` at merge `12a0615`; feature branch `codex/field-data-reliability`.

## Problems addressed

Daily report insert/update, crew deletion/replacement, and initial follow-up creation previously used separate HTTP transactions. Failures could leave partial reports, erase crews, or create reports again on retry. Date validation accepted normalized impossible dates. Updates lacked concurrency checks, and report editors had no confirmed-save feedback or recoverable submission identity.

## Implementation

`save_field_report` is a SECURITY INVOKER PostgreSQL RPC, preserving existing authenticated RLS. Report, crew replacement, optional initial task, and retry receipt commit or roll back together. Company and author come from authenticated database context, not submitted IDs. Existing report IDs and task/photo relationships remain intact.

An authenticated actor/company-scoped append-only receipt records the request payload and result. A transaction-level lock serializes the same submission key. Exact retries return the original result without repeating writes; reusing a key with changed content is rejected. Report updates lock the report and require its opening revision; a trigger increments revision on every report update. Independent concurrent edits cannot silently overwrite each other through this workflow. Existing direct table API permissions remain unchanged; atomic saves are implemented by this application RPC, not enforced as a universal restriction on every possible direct SQL client.

Server and database validations cover dates, report substance, crew trade/counts, limits and ownership. No service-role client, schema deletion, production data changes, new dependency or AI call is introduced. A missing RPC fails closed with an administrator message; there is no nontransactional fallback. Migration must be reviewed/applied before releasing the application change.

The mobile-friendly form disables pending submissions, retains inputs on errors, confirms success only after the RPC result, and freezes edits when confirmation is uncertain. Retrying uses the exact stored request. SessionStorage drafts are scoped to user/company/report and recover across reloads in the same tab. Drafts are cleared on confirmed success and explicit logout; switching authenticated users prunes the previous user’s drafts. Users can explicitly discard a rejected draft and reload current data. This is tab-local recovery, not an offline background queue or cross-device draft service. Storage-blocked browsers show a warning. Photos remain a separate private-storage workflow after report confirmation; blob uploads are not included in the database transaction.

## Database changes

`supabase/migrations/20261008054310_field_report_atomic_save.sql` adds:
- `field_logs.revision`, positive integer, default 1, with update trigger.
- `field_report_saves` with company/request primary key, report/project/actor relationships, actor/company RLS and SELECT/INSERT grants only.
- Restricted authenticated execution of `save_field_report`; anonymous/public execution revoked.

Receipt payloads contain report information and remain tenant/actor protected. There is no automatic expiration or pruning; review retention policy before introducing cleanup.

## Isolated development setup

Prerequisites: Docker-compatible runtime and Supabase CLI (verified available CLI 2.117.0). Never link this configuration to a hosted project. Never use production env files for write acceptance.

1. `npm run db:isolated:prepare` generates ignored `supabase/migrations/19700101000000_local_baseline.sql` from existing canonical `sql/week*.sql`, plus a local-only NOLOGIN extractor role required by historical grants. This generated baseline is for a fresh local database only, not a production migration.
2. `docker network create -o com.docker.network.bridge.host_binding_ipv4=127.0.0.1 sitepm-isolated-local` (once).
3. `supabase start --network-id sitepm-isolated-local --exclude realtime,storage-api,imgproxy,studio,postgres-meta,edge-runtime,logflare,vector,supavisor`.
4. `supabase status -o env > .env.isolated.local`. Keep this ignored file local; do not print or publish keys. It contains only this local stack's keys/URLs.
5. `npm run test:field-reliability:db` uses only `.env.isolated.local`, refuses non-loopback API/DB hosts or ports other than 55431/55432, creates synthetic A/B users/jobs and exercises real REST/RPC/RLS writes. Fixtures are retained for inspection; failure-injection triggers are removed in `finally`.
6. `node scripts/setup-isolated-browser.mjs` creates local-only browser A/B accounts (browser-a@sitepm.test / browser-b@sitepm.test, password `Local-only-SITEPM-test-2026!`) and synthetic jobs. These are deliberately local test credentials, never hosted credentials. Then `node scripts/start-isolated-app.mjs` starts Next on 127.0.0.1:3107 with explicit local Supabase overrides. Sign in using a synthetic local account to exercise field saves. This launcher is local-only, never a deployment command.
7. Stop this project's services with `supabase stop` from the repository; it must not stop unrelated local projects. Do not use `--all`.

Project ID `sitepm-isolated`, API 55431, PostgreSQL 55432, reserved Studio/mail/shadow/pool ports 55433/55434/55430/55439. Existing Authenticity Engine containers and production are untouched. Optional local Storage startup failed its health check in this environment; the reduced stack supports database/Auth/API acceptance, not local blob acceptance. Existing photo metadata/relationships are still tested through PostgreSQL.

## Verification

Passed:
- `npm run test:field-reliability`: actual server actions under a recording RPC boundary; validation, single atomic call, authorization context, rejected/uncertain/stale results and post-save refresh failure.
- `npm run test:field-reliability:db` against the dedicated live local Supabase stack, twice: create/update with crews and linked task, metadata relationship preservation, invalid writes, forced crew/task failure rollback, corrected retries, duplicate/concurrent requests, delayed replay, simultaneous editors, Company A/B read/write isolation, forged receipt rejection and anonymous refusal.
- `supabase db advisors --local --type security --level warn --fail-on error`: no issues found.
- Operations, Core Job schema/unit, Job Desk, Ask Stage 3 and Ask lexical regressions; TypeScript; lint (zero errors, existing unused `tokenize` warning); supported webpack production build; diff whitespace checks.

Browser: authenticated synthetic Company A successfully reached Home on the local app. The browser disconnected twice before saved form acceptance and subsequently reported no available browsers. Browser save/pending/failure/reload recovery and mobile visual acceptance remain UNVERIFIED. Do not substitute the database tests for those UI checks. The local runtime was stopped after the browser connection became unavailable.

Existing Next middleware deprecation and webpack cache warnings remain. No production record, hosted schema, or deployment was modified.

## Next milestone

The next scheduling UI milestone is the functional month/week Schedule calendar documented in PRODUCT_ARCHITECTURE.md and UI_UX_IMPLEMENTATION_2026-10-07.md. It is intentionally separate from field persistence.
