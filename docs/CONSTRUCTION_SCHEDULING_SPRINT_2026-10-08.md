# Sprint 4 — Construction scheduling and workforce coordination

## Baseline and release dependency

Development is isolated in `codex/construction-scheduling`, based on Sprint 3 `44e5bda04049736e567826b3793ba81025fe6763`. Production remains Sprint 2 `12a0615a73f95745173173b6e5661b74e556e16f`. Sprint 3 PR #3 remains unmerged. This sprint performs no production queries, data writes, migrations, credential resets, deployment, or merge.

Stacking preserves the accepted Sprint 3 app and test infrastructure. Scheduling has no runtime dependency on the field-report RPC, but the branch includes Sprint 3 ancestry and is intended to release afterward. Review the Sprint 4 PR against `codex/field-data-reliability`; after PR #3 merges, retarget to main and reconcile its merge ancestry without dropping either sprint. Do not cherry-pick an unreviewed subset into production.

## Delivered workflow

- Company `/schedule` and project schedule share a functional month/week/day calendar, date navigation, creation and editing, all-day and continuous timed/multi-day work, timezone, description, trade, activity type, milestone, predecessor, linked task, assignments and expected worker counts.
- Desktop drag opens a reschedule preview requiring an explicit confirmed save. Touch/keyboard users edit dates. Mobile month uses a compact date/count overview opening the day agenda; week/day use readable cards.
- Company resources are reusable across jobs: employees, subcontractor companies, individual subcontractors, crews, suppliers/vendors and other external participants. Optional contact/company/trade/notes fields; edit or deactivate rather than destroy history. A directory entry grants no account or project access.
- Multiple assigned resources and optional expected workers per assignment. Shared-resource time overlaps are potential coordination issues, not asserted conflicts. Calendar filters by job, trade, type and assigned resource.
- Planned, confirmed, in progress, completed, delayed, on hold, cancelled; trade color remains stable and type/status use text. Cancellation requires confirmation and preserves history, assignments and recovery by editing status. Hard deletion is deliberately unavailable.
- Task references are validated within the same job. Daily reports record actual work separately. Home shows expected work today in each activity's timezone; project lookahead includes assignments and task links, excludes cancelled work, and preserves existing follow-ups. Existing project overview and schedule summaries consume the same activity records.
- Confirmed saves refresh the calendar. Failed validation retains inputs, uncertain submissions freeze the exact request for retry, interrupted requests recover from tab storage, and stale revisions require reconciliation. No optimistic success. Logout/account separation uses the existing report-draft namespace and cleanup.

These are plans and assignments, **not attendance**. There is no invented presence timestamp, timeclock, automatic task completion, or automatic actual performance inference.

## Schema and authorization

Migration: `supabase/migrations/20261008163441_construction_scheduling.sql`.

Extends existing `schedule_activities` rather than duplicating schedules: revision, type, all-day, wall-clock times, IANA timezone, derived timestamptz boundaries and optional task reference. Existing date columns, IDs, dependencies, project relationships and compatible status keys remain. UI labels map `not_started` to Planned, `done` to Completed, `held` to On hold. Adds confirmed/delayed/cancelled. Unchanged assignments and predecessors are retained rather than generating false remove/re-add events.

New company-scoped tables:

| Table | Purpose |
| --- | --- |
| schedule_resources | Reusable company directory, type/contact/trade, active flag, revision |
| schedule_assignments | Activity/resource many-to-many relationship and expected worker count |
| schedule_history | Append-only snapshots of activity, status, dates, assignment and dependency changes, authenticated actor and timestamp |
| schedule_requests | Actor/company-scoped request receipts for exact retries |

Composite activity/company and resource/company foreign keys reject cross-company assignments. RLS uses existing `current_company_id()`. Project and task ownership are checked inside the database. No anonymous writes, service-role app credentials, participant access grants, or editable audit rows. Only narrow trigger-only audit functions use SECURITY DEFINER with fixed empty search paths and revoked direct execution. The save RPC uses SECURITY INVOKER and existing authenticated RLS.

`save_construction_schedule` atomically saves activity, dependency, assignments and receipt. Resource saves use the same request/revision contract. Per-request advisory locking prevents duplicate commits; row locking plus expected revision rejects stale edits. A company advisory lock serializes RPC dependency changes. Exact receipt replay returns the prior result without overwriting subsequent edits. Direct authenticated table updates remain company-protected and revisioned/audited for compatibility; atomic composite editing is provided through the RPC.

Database validation covers positive revisions, bounded names/notes/counts, real dates, ordered intervals, types/statuses, valid timezone, active assigned resources, task/project ownership, existing dependency cycle/same-project checks, and assignment uniqueness. Enum statuses permit corrections/reopening rather than enforcing a speculative irreversible state machine.

## Time and history semantics

All-day start/finish dates are inclusive; derived finish instant is the following local midnight. Timed intervals are continuous, including overnight/multi-day work; they are not daily recurring shifts. Per-day cards label continuation. IANA timezone is explicit, initially the browser timezone for new entries, and must be checked for the job. Legacy records default to UTC until edited; dates are not silently shifted. Overlaps compare UTC instants; adjacent intervals are not overlaps.

Nonexistent spring-forward local times are rejected. Ambiguous fall-back local times follow PostgreSQL's standard-time interpretation; explicit fold selection is not implemented. No recurrence or per-project timezone setting is introduced.

Snapshots preserve original and revised schedule values from adoption onward. Pre-migration history cannot be reconstructed. The UI shows the latest 100 history events for the current view; the database retains all. Actor IDs are authenticated user identifiers, mapped to company team names when available. Human-readable changes appear in the UI; full snapshots remain in PostgreSQL. Audit history is an integration foundation, not a formal baseline or critical-path engine.

## Reproducible isolated testing

Use the Sprint 3 setup in `docs/FIELD_RELIABILITY_SPRINT_2026-10-07.md` and committed isolated Supabase config and generated local SQL baseline (`npm run db:isolated:prepare`). Credentials stay in ignored `.env.isolated.local`; test scripts require loopback API 55431 and database 55432. Never substitute production endpoints. Preserve existing local fixtures; do not reset a shared or production database.

Apply pending migrations only to this isolated instance with a local PostgreSQL client and refresh PostgREST schema cache. This sprint applied its migration to the running isolated PostgreSQL 17/Supabase database. Run:

```sh
npm run test:scheduling
npm run test:scheduling:db
node scripts/start-isolated-app.mjs
node scripts/start-isolated-app.mjs --build
```

The app launcher supplies isolated Supabase settings for both dev and supported webpack production build; `--production` starts that build. Synthetic browser accounts/records are explicitly labeled and isolated. `scripts/construction-browser-fixtures.mjs` supports local-only inspection, stale-edit simulation and an optional delay for one named synthetic activity; always remove the fault trigger using `off`. No production credentials or business records are required.

## Acceptance results

- Local live database: create/update/multiple employee/subcontractor assignments; exact and concurrent duplicate retries; competing edits; foreign-company resource rollback (activity, assignments and audit); A/B read/write isolation; unauthorized insert/update; anonymous rejection; forged assignment/history/receipt; foreign project/task rejection; hard delete refusal; invalid dates/times/timezones, spring DST gap, counts and duplicate assignments; dependency cycle/same-job checks; cancellation/history; inactive-resource rejection. Passed.
- Unit/action tests: real action boundary uses one RPC and authenticated scope, validation before write, sanitized database errors, stale/uncertain classification; calendar month/week/day, leap/DST date math, stable trade colors, multi-day continuation, overlap adjacency/tenant/cancellation. Passed.
- Existing operational lookahead, core job schema/logic, job desk, field reliability, Ask Stage 3 and lexical suites. Passed.
- TypeScript and supported production build. Passed. Lint has zero errors and one pre-existing warning in `lib/ask-stage4e-fts-experiment1.ts`. Existing Next middleware deprecation remains.
- Browser acceptance details are recorded below after completion. Browser viewport emulation is not physical-device testing.

## Release prerequisites and recovery

Do not apply this migration to production from this sprint. Production backup/recovery prerequisite is still unresolved. First release Sprint 3 under its separately authorized reviewed plan. Review this additive migration against the then-current schema, verify backup and isolated restore, obtain explicit Sprint 4 release authorization, briefly pause schedule writes, apply only the approved migration, verify function signatures/grants/RLS/indexes/constraints, then deploy the matching application. Existing deployed date-only schedule writes remain accepted; new richer statuses should not be introduced until the new app is live. New app queries require the migration, so application-first deployment is unsupported.

If migration preflight fails, stop. If app rollout fails, pause schedule writes and restore the last compatible application while preserving the additive schema and captured records; inspect new status handling before re-enabling an old UI. Do not drop tables/columns, erase schedule history, reset credentials, or perform destructive restoration as an automated rollback. A forward fix or separately reviewed recovery is required for data issues.

## Limits and next milestone

Server reads paginate activities, dependencies, assignments, resources and team names to avoid API row-limit truncation. The calendar still loads the company schedule with client filtering; large portfolios need date-window queries and server overlap queries before scale claims. Overlap detection is pairwise and does not model resource capacity. Directory resources have no subcontractor login, notifications or external sharing. Tab-local drafts are not a durable offline database and do not survive closed-tab/device loss. There is no recurrence, actual attendance capture, drag time-grid, bulk import, Gantt, critical path, formal baselines, labor forecast, cost codes or predictive completion. Multiple existing predecessor relationships are preserved and editable; this is not a Gantt dependency graph UI.

Recommended next sprint: contractor pilot acceptance and schedule-to-field evidence reconciliation, with measured calendar performance and capacity-aware coordination. Add advanced analytics only after reliable actual evidence and explicit baseline semantics. Marketing, discovery, beta recruitment and monetization remain parallel roadmap workstreams.

Public functional inspiration: [Buildertrend scheduling](https://buildertrend.com/project-management/schedule/) and its [public construction scheduling guide](https://buildertrend.com/wp-content/uploads/2024/07/BC4330-Gated-PDF_Scheduling-for-Construction.pdf). No proprietary design/code was copied; no schedule reference image was found in inspected repository materials.

## Browser acceptance — isolated environment

Desktop browser interactions passed resource creation (crew, employee, subcontractor company), activity creation, task reference, timed rescheduling, status updates, confirmed saves, pending disabled controls, trade/type filters, month/week/day navigation, cancellation confirmation and hidden/show-cancelled behavior. Dragging opened a date-change preview without saving. Project calendar, lookahead and Home reflected the same saved records and expected assignments.

An invalid timezone was rejected by PostgreSQL; the UI retained inputs, restored the draft after reload, and confirmed a corrected retry. A competing synthetic edit caused a stale-revision warning; explicit discard/reload recovered the latest record. Reloading an in-flight request restored its identity and froze edits until exact retry. The injected database delay caused an unconfirmed/rolled-back attempt; after removing the delay, retry confirmed one activity and one receipt. Live database tests separately verified replay after a committed response and simultaneous duplicate requests.

The isolated supported production build also passed subcontractor creation, assignment of employee/subcontractor/crew together, inspection creation with two predecessors, readable named audit history and visible potential overlap. Company B's directory/calendar contained none of Company A's data, showed only its own job, and returned 404 for Company A's project schedule.

Responsive browser checks at 390×844 and 320×740 passed readable week/day cards, compact month-to-day navigation, failed-save/recovery controls and no document horizontal overflow. These are browser viewport checks, not physical-device or offline-network certification. Optional Supabase Storage/blob services were excluded from the local stack; scheduling does not add or change photo storage. Existing photo/task/report relationships were preserved, with regression coverage; no new blob upload acceptance is claimed.

During verification, concurrent execution of standalone TypeScript and a build briefly raced generated `.next/types`; rerunning TypeScript after the completed build passed. Initial formatter/font downloads needed network access. These were local harness issues, not waived application failures. The final lint result remains zero errors and one pre-existing unused-tokenize warning; no new lint failures are accepted.

## Change inventory

- Calendar/directory UI: `components/schedule-board.tsx`, `resource-directory.tsx`, `schedule-record-form.tsx`, `expected-schedule.tsx`; navigation and lookahead components.
- Company/project schedule pages, resource page, and route loading/error boundaries; Home expected-work integration.
- `lib/schedule.ts`, `schedule-types.ts`, `schedule-actions.ts`, `schedule-logic.ts`, `construction-calendar.ts`, `operational-lookahead.ts`.
- One scheduling migration; scheduling database/unit suites; local browser fixture controls; isolated app build launcher and package scripts.
- Product vision, roadmap, this implementation/acceptance/release document, and an architecture addendum. PROGRESS is appended separately and deliberately left uncommitted for user review. Main commissioning documentation is unchanged.
