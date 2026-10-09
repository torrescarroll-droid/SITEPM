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
6. `node scripts/setup-isolated-browser.mjs` creates local-only browser A/B accounts (browser-a@sitepm.test / browser-b@sitepm.test, password `Local-only-SITEPM-test-2026!`) and synthetic jobs. These are deliberately local test credentials, never hosted credentials. Then `node scripts/start-isolated-app.mjs` starts Next on 127.0.0.1:3107 with explicit local Supabase overrides. Sign in using a synthetic local account to exercise field saves. Use `npm run build -- --webpack` followed by `node scripts/start-isolated-app.mjs --production` to test the supported production build. This launcher is local-only, never a deployment command. For browser fault injection, `node scripts/field-browser-fixtures.mjs on` installs local-only rejection/delay triggers; always run `off` afterward. `inspect` reports synthetic Company A results; `stale <synthetic report UUID>` simulates a competing edit only within that company.
7. Stop this project's services with `supabase stop` from the repository; it must not stop unrelated local projects. Do not use `--all`.

Project ID `sitepm-isolated`, API 55431, PostgreSQL 55432, reserved Studio/mail/shadow/pool ports 55433/55434/55430/55439. Existing Authenticity Engine containers and production are untouched. Optional local Storage startup failed its health check in this environment; the reduced stack supports database/Auth/API acceptance, not local blob acceptance. Existing photo metadata/relationships are still tested through PostgreSQL.

## Verification

Passed:
- `npm run test:field-reliability`: actual server actions under a recording RPC boundary; validation, single atomic call, authorization context, rejected/uncertain/stale results and post-save refresh failure.
- `npm run test:field-reliability:db` against the dedicated live local Supabase stack, twice: create/update with crews and linked task, metadata relationship preservation, invalid writes, forced crew/task failure rollback, corrected retries, duplicate/concurrent requests, delayed replay, simultaneous editors, Company A/B read/write isolation, forged receipt rejection and anonymous refusal.
- `supabase db advisors --local --type security --level warn --fail-on error`: no issues found.
- Operations, Core Job schema/unit, Job Desk, Ask Stage 3 and Ask lexical regressions; TypeScript; lint (zero errors, existing unused `tokenize` warning); supported webpack production build; diff whitespace checks.

Browser automation was recovered using a fresh localhost tab. Against the isolated production build, verified report creation with crews and linked follow-up, pending controls, input retention after server validation, reload draft restoration, source-report navigation, report/crew update, injected database rejection with rollback verified in PostgreSQL, corrected retry, stale-edit rejection and explicit reload recovery. Reloaded a delayed in-flight save after submission: the database committed once, the recovered form froze editing until retry, and exact retry confirmed the original report/task/receipt without duplicates. Responsive checks at 390×844 and 320×740 showed readable feedback, mobile navigation and no document horizontal overflow. A follow-up verification entry below records final-build and account-isolation results.

Read-only production catalog review found compatible prerequisites and no object collisions. The isolated live database suite additionally passed the deployed baseline application’s direct report insert/update and crew replacement against the migrated schema, followed by an RPC edit. See `FIELD_RELIABILITY_RELEASE_PLAN.md` for migration-first rollout, legacy-client cutover precautions and nondestructive application rollback. Production migration/deployment remain authorization-gated.

Existing Next middleware deprecation and webpack cache warnings remain. No production record, hosted schema, or deployment was modified.

## Next milestone

The next scheduling UI milestone is the functional month/week Schedule calendar documented in PRODUCT_ARCHITECTURE.md and UI_UX_IMPLEMENTATION_2026-10-07.md. It is intentionally separate from field persistence.

## Readiness closeout — 2026-10-07 PDT

All outstanding report saved-flow and responsive acceptance checks passed on the isolated environment. Final webpack build was restarted and exercised with Company B: interrupted submission/reload/exact retry confirmed once, recovered-draft instruction disappeared after confirmation, and mobile report/crew editing persisted the new text and four-worker Carpentry crew. Company B saw only its own job/reports and received 404 for Company A's source-report URL. Logging out with an unsaved Company A draft and signing in as B showed a clean B form. No production writes were used.

One UI issue was corrected: clear the recovered-draft review instruction after a confirmed save. Added a guarded production-build local launcher, reusable local browser delay/rejection fixtures, and deployed-app compatibility assertions in the database suite. An initial compatibility-fixture failure used an auth-user UUID where `created_by` requires a profile UUID; the fixture was corrected and the complete database suite then passed. No product foreign-key issue was found.

Final checks: field reliability, operations, Core Job, Job Desk, Ask Stage 3, Ask lexical, TypeScript, lint (zero errors; existing unused-tokenize warning), webpack production build and whitespace checks passed. Temporary browser fault triggers were removed before the final local security-advisor check. Production review was catalog-only; schema and records remain unchanged. The current app and dedicated local services were stopped after acceptance, preserving local database fixtures.

Remaining limits are documented in `FIELD_RELIABILITY_RELEASE_PLAN.md`: unchanged blob upload workflow was not revalidated because optional local Storage was unavailable; physical-device/cellular testing remains beta follow-up. These do not block review of the report/crew transactional workflow. Merge, migration and deployment still require separate authorization.
