# LINEHORSE UI/UX implementation — October 7, 2026

## Baseline and isolation

- Fresh GitHub clone: `torrescarroll-droid/SITEPM`.
- Verified `origin/main` equals and contains `abb8dab75d131b64a1a385c687653336ff2823a7`.
- Branch: `work/linehorse-ui-ux`, created directly from that exact commit.
- Workspace: `/Users/romulotorres/.codex/.chatgpt-projects/g-p-6aa5ef11bb1c8191bdb75abd16285a4a/linehorse-ui-implementation`.
- The founder checkout was not accessed or modified in this implementation run.
- No reconstruction of Week 11; no deployment, hosted data access, schema, policy, secrets, or authentication changes.

## Implementation

1. Foundation (`061e2cf`): charcoal/warm-white/brass tokens; shared panels, headings, notices, status treatments, focus styles and field targets. Active is neutral; complete is green; overdue is red; flagged/high priority is amber. Existing status calculations remain intact.
2. Shell (`1201cdb`): dark shell, brass selection markers, current-page semantics, navigation labels, skip link, job tabs, responsive workspace spacing. Existing destinations retained.
3. Job Desk (`257f3b7`): identity → attention → schedule → open to-dos → reports/photos → files → Ask. Wide-screen main/secondary columns preserve mobile and document reading order. Compact two-column phone metadata.
4. Home (`030716d`): overdue to-dos → active jobs → recent reports; help secondary. Same queries, filters, ordering, report limit, and counts.
5. Record screens (`c0002a0`): grouped rows for jobs, documents, schedules and editable to-dos; narrative report panels retained; existing forms remain visible with unchanged fields/actions; restrained Ask styling with all notices and evidence behavior retained.

Revert in reverse phase order if needed; later phases use the foundation classes. No dependency changes or new product features.

## Phase 0 observations

- TypeScript passed.
- Eight selected regression suites passed.
- ESLint: zero errors; existing unused `tokenize` warning in `lib/ask-stage4e-fts-experiment1.ts`.
- Default build failed fetching Google Fonts in the sandbox; approved Turbopack attempt failed binding a worker port. Baseline webpack attempt was stopped while compiling. Do not represent the baseline production build as passed during this run.
- Retained baseline fixture HTML/CSS under ignored `artifacts/ui-review/baseline/` before source edits. Baseline desktop/phone reviewed in the browser.

## Validation

- Updated TypeScript and lint passed (same one pre-existing warning).
- Eight unchanged suites passed: core-job, job-desk, ask, ask-lexical, stage4d, stage4c, stage4f-b, and the standalone stage4f-d unit runner. Hosted writer suites were not run.
- Webpack production build passed using ephemeral `SUPABASE_URL=https://example.invalid` and an inert anonymous-key placeholder. No environment file was created. Fonts were fetched through the approved build attempt. Default Turbopack remains environment-blocked, not validated.
- A TypeScript AST comparison verifies identical native form/control non-style attributes against `abb8dab`: form actions, hidden IDs, field names/defaults, requirements, options, event handlers, disabled conditions and submit types.
- Protected `lib/`, `sql/`, authentication, middleware, package and lock files are unchanged.
- Token contrast checks: main/secondary and semantic text pairs exceed 4.5:1; field borders and light-surface selection markers were darkened to exceed 3:1. This is not a claim of comprehensive WCAG certification.
- Browser fixture checks: 390px phone and 1024px tablet showed no page-level horizontal overflow across Job Desk, Home, documents, tasks, schedule, reports. Phone form text is 16px; visible buttons meet the 44px minimum (48px styling on phone).
- Desktop Job Desk composition and Home ordering visually inspected at 1440px. Full document layout reviewed. Fixtures use the actual built Geist font for final review.
- Fixtures are server-rendered from product components with synthetic records and disabled actions. They do not prove client hydration, persistence, live authentication, A/B isolation, or real-file operations. The Home greeting fixture is its pre-hydration rendering.
- Logs, fixture renderer, baseline snapshots and form-contract audit are retained under ignored `artifacts/ui-review/`.

## Remaining acceptance

Authenticated acceptance requires approved environment configuration outside the protected founder checkout. It was requested, not supplied during the implementation pass. No production credentials were copied and no live test records were created.

Before release, verify live company/job navigation, create/edit/save/done/reopen/delete, report/crew entry, photo upload/open, document open, Ask pending/keyboard/error/citation states, and Company A/B refusals against an approved test environment. Do not treat fixture screenshots or static form checks as a substitute for those flows.

A baseline edge case is retained: `hasAttention` includes late schedule activities, while the attention section only lists overdue/high-priority to-dos and flagged reports. A job with only a late activity can therefore show an empty attention section; its late activity still appears in Schedule. Resolve separately with approval rather than changing the data model/calculation during this presentation tranche.

## Approval and environment observations

- GitHub clone needed network escalation; completed.
- Dependency installation needed network escalation after a missing cached package; completed without lockfile changes.
- Font fetching/build attempts needed network escalation; webpack compiled successfully.
- Localhost fixture-server port binding needed escalation; server bound only to 127.0.0.1.
- Source edits, branch creation and local phase commits succeeded in the isolated workspace without founder-checkout filesystem permission.
- These results do not establish cross-session permission persistence.

## Delivery

Implementation is local, not pushed, merged, or deployed. Phase 6 is partial pending authenticated acceptance and founder visual review. `PROGRESS.md` is appended separately and intentionally uncommitted under repository instructions.


## Next major scheduling UI milestone — October 7, 2026

The project Schedule will use a functional, interactive, color-coded calendar as its primary interface. Provide month and week views; create and edit existing scheduled activities; show milestones, dependencies, delays, holds, and overdue work. Maintain consistent trade-specific colors and separate status icons/badges so status never obscures trade identity. Integrate existing activities with operational lookahead, dependency readiness, and task follow-through using current Supabase relationships, authentication, and company-scoped authorization.

Follow LINEHORSE’s superintendent working desk direction: rugged, not rustic, restrained industrial colors, clear hierarchy, mobile-friendly controls, accessible text/status cues in addition to color. Reuse the previously supplied schedule reference image if it becomes available; no matching image was found in the current repository materials. This is the next scheduling UI milestone, not part of the active Field Data Reliability sprint. Acceptance requires persisted add/edit flows, month/week navigation, clear empty/loading/error states, and tested tenant isolation; a static calendar mockup does not satisfy it.
