# Operational lookahead and report follow-through — October 7, 2026

## Baseline and milestone

Baseline: `f70d654624bc761c85b695ae3fb8899d74c3a104`, Week 11 Core Job Operations plus the LINEHORSE UI/UX merge.

Repository inspection found persistent projects, tasks with owner/trade/location fields, daily reports and crews, report-linked tasks, private photos, schedule activities and predecessors, company-scoped server reads/actions, SQL RLS and parent guards, and existing schema/unit test runners. Ask and document extraction/retrieval already exist; they were not extended. The build specification and beta markdown predate some Week 11 capabilities, so implementation and SQL are the baseline.

The selected milestone closes the gap between capturing site conditions and following through on them. It reuses existing records instead of adding another issue tracker or inferring construction completion from task counts. No dependencies or database migrations are added.

## Workflow

- Home shows due/overdue to-dos and reports without linked actions for each active job, with direct lookahead links. Existing overdue items and recent reports now link to their records.
- Every job has a Lookahead tab; the Job Desk links directly to it.
- The inclusive fourteen-day view includes overdue and upcoming due to-dos, current/held/planned activities, overdue planned finishes, predecessor completion checks, and open work grouped by normalized recorded trade. Tasks and schedule activities stay distinct.
- Flagged reports and recorded delays show linked tasks, owners, dates, statuses, and ready-photo counts. Reports without actions remain visible. Completed linked tasks are described as completed tasks, never proof that a site issue is resolved. The original attention flag remains independently editable.
- A source-report page shows the report, equipment/site-event/safety details, private photo links, report editing/photo capture, linked task editing, and a form for additional follow-ups. Description and location are carried forward from the report; the builder supplies the action, owner, trade, and deadline.
- Task status controls return pending, success, validation, authorization, failed-write, and stale-write feedback. Completion records a timestamp; reopening clears it. Source-report links survive task editing.
- Planning gaps identify open work without owners or due dates. Counts describe recorded tasks/activities, not physical construction progress.
- New routes have loading and retryable error states. Empty jobs show useful explanations and links into existing capture workflows. Both guides explain follow-through.

## Security and persistence

All persistence uses the existing authenticated Supabase client and tables. Source-report attachment is checked server-side against the current company and selected project before inserting a task. Status updates require an authorized task and constrain the write by company, project, and read status. Derived joins filter every record by company and job as defense in depth. Source-report reads constrain company, project, and exact report ID. Existing RLS and the same-job task/report trigger remain unchanged. Private photo access uses the existing authorized signed-URL action.

No production business records, storage objects, schema, policies, deployments, main commits, or remote refs are changed. Read-only A/B verification creates and revokes authentication sessions. The intentional commissioning document remains untracked and byte-identical: SHA-256 `261b83d63bfbd68a4e10fc4535c2bfc828bdc9d7604fa6f5d226476aefe20ab9`.

## Changed files

- Routes: `app/(app)/page.tsx`, `app/(app)/guide/page.tsx`; new `projects/[id]/lookahead/{page,loading,error}.tsx` and `projects/[id]/field/[reportId]/{page,loading,error}.tsx` beneath `app/(app)`.
- Components: new `operational-lookahead.tsx`, `task-status-control.tsx`; updates to `project-tabs.tsx`, `job-desk.tsx`, `field-log.tsx`, `task-list.tsx`, `ui.tsx`.
- Data/actions: new `lib/operational-lookahead.ts`; updates to `task-actions.ts`, `field-logs.ts`, and field-log/photo/schedule action revalidation.
- Verification: `scripts/operational-lookahead-unit.ts`, `operational-actions-unit.mjs`, `run-operational-lookahead-unit.mjs`, `operations-readonly.mjs`; `package.json` adds `test:operations`.
- Documentation: this report, `docs/PRIVATE_BETA_GUIDE.md`, and an append-only `PROGRESS.md` entry left outside the implementation commit for review.
- SQL/migrations: none.

## Verification

Results are appended after final verification below.

## Remaining limits and next milestone

No isolated development database is configured. New mutation paths are exercised through actual server actions with a recording database boundary; hosted business-data writes are deliberately not run. Authenticated read-only acceptance and RLS checks complement those tests but do not establish browser-interaction or live write acceptance. Lookahead uses the application's existing server-local date convention and existing list-query limits. It does not introduce critical-path calculations, inferred task/activity dependencies, model-generated actions, or subcontractor identity/permissions.

Recommended next milestone: reliable daily-report persistence, with an isolated database and atomic report/crew capture plus safe recovery from partial saves. The existing report/crew save uses multiple database operations; this sprint does not claim those are transactional.

## Final verification results

- `npm run test:operations`: passed. Calendar boundaries/leap dates, overdue versus completed work, readiness, trade normalization, evidence joins, immutable input, empty states, company/project filtering, source-report authorization, ignored forged company IDs, owner/date write payloads, invalid inputs, failed/zero-row writes, completion timestamp preservation and reopening.
- `npm run test:core-job`, `npm run test:job-desk`, `npm run test:ask`, `npm run test:ask-lexical`: all passed.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run lint`: passed with zero errors and the existing unused `tokenize` warning in `lib/ask-stage4e-fts-experiment1.ts`.
- `npm run build -- --webpack`: passed on the final implementation; both new dynamic routes appear in the build. The default `npm run build` fails in this execution environment because Turbopack's CSS worker cannot bind a port (`Operation not permitted`), including on the elevated retry. The supported webpack production build succeeds. Existing middleware deprecation and an initial webpack Edge-runtime dependency warning were observed; middleware was not migrated in this sprint.
- Existing authenticated A/B read checker: passed for projects, tasks, reports, documents, schedule activities and photos; B exact-ID requests cannot read A rows, and A retains access. B's lists contain no foreign-company rows in the checked results.
- `node scripts/operations-readonly.mjs` against the local production server: passed. A renders lookahead/source report/home links; B receives not-found refusal without protected workflow content; malformed report IDs receive not-found refusal; signed-out requests redirect to login. As documented in the installed Next.js `not-found` guide, loading boundaries can stream HTTP 200 before `notFound()` resolves. The test checks refusal markup/noindex and absence of protected content, rather than equating HTTP 200 with access.
- `git diff --check`: passed. Commissioning document SHA-256 remains identical to the baseline.

Business-data mutations and browser-interaction acceptance were not performed. No migration was needed or applied. The new reusable read-only acceptance script reads existing A/B credentials from local configuration without logging them and refuses non-loopback application URLs.

## Closeout review — October 7, 2026

Reviewed implementation `318937d` against the milestone, authenticated read paths, mutation authorization, task/report relationships, and existing RLS. No new authorization gap or blocking architectural issue was found. A routine task-editor fix keys its status selector to the persisted status so a quick status update cannot leave the editor displaying its previous selection; editor saves now show accessible success/error feedback.

The previously uncommitted progress entry was reviewed and its historical claims match the recorded sprint results. It is committed for this closeout under the founder's explicit authorization; a new entry records the closeout verification and limitations without rewriting the earlier entry.

Browser interaction acceptance was performed against the local production build with the existing A/B test accounts. One-shot loopback authentication helpers kept credentials out of tool output, closed their listeners after login, and both browser sessions were logged out afterward. Checks passed for Home → Lookahead → source report navigation, rendered report/crew/schedule/task information, an unsaved status selection, required-title validation that prevented submission, unsaved follow-up field input, report editor expansion, and opening the existing private signed photo (loaded at 1024 × 768). Company B received the not-found view on Company A's source-report and lookahead URLs with no protected project content. Signed-out access returned to Sign in. No business-data mutation, upload, deletion, or saved form submission was performed.

An isolated SITEPM write-test environment is unavailable: Docker contains only the unrelated Authenticity Engine stack and Supabase lists no development branches for SITEPM. These environments were not repurposed, and production was not used for write acceptance. Actual action tests with a recording database boundary remain the mutation-path verification. Browser save/reopen and database-write acceptance remain explicitly unverified.

The closeout reran operations, Core Job schema/unit, Job Desk, Ask Stage 3, Ask lexical, TypeScript, lint, and a webpack production build. Detailed outcome is recorded in the final closeout progress entry. The original Turbopack environment restriction and existing lint warning remain documented above.

Scope stays within the accepted milestone: no schema/RLS changes, dependency additions, new AI behavior, deployment, or merge into main. Existing server-local date/list-query limits and multi-operation daily-report saves remain known limitations, not claims of new transactional or scheduling guarantees. The sprint is ready for merge review with isolated mutation acceptance still outstanding.
