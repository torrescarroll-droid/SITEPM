# Sprint 6 — LINEHORSE visual transformation

Development base: Sprint 5 `5f3403a65ef4fd3090684682d8e65c5819c30b37`, which includes Sprint 4 `870f9a2` and Sprint 3 `44e5bda`. Branch: `codex/linehorse-visual-transformation`. No existing release branch or main was modified.

## Delivered

- Dark charcoal/midnight shell, wordmark and KEEP YOUR PROJECT RUNNING statement, restrained copper primary actions and warm neutral work surfaces based on the supplied mockup.
- Reusable tokens, headers, cards, numerical summaries, visible forms, record stacks, status treatments, focus outlines and calendar controls. Existing typography dependencies retained.
- Dashboard summaries reuse active-job, overdue-task and recent-report data already loaded by the page. Recent reports explicitly count the latest reports shown below, not every company report.
- Project list/header, project overview/tabs, task/report/document forms, resource controls and Ask action adopt the shared visual language. Calendar preserves month/week/day behavior, trade identity, separate status and save contracts.
- Desktop identity context and mobile navigation including an accessible native More disclosure for existing resource/guide/logout destinations. It closes after navigation; no permissions are simulated.
- One local, optimized generated construction image on the authentication surface only. It is decorative, not project evidence. No horse logo, operational watermark, repetitive hero imagery or new modules.

See [visual system and asset provenance](LINEHORSE_VISUAL_SYSTEM.md).

## Scope and review

Diff is limited to frontend presentation, shell disclosure behavior and documentation/assets. `lib/`, `supabase/`, `app/auth/actions.ts`, route handlers and middleware are unchanged. Existing action names, payloads, identity/role props, tenant boundaries, report draft cleanup and version/current semantics remain intact. No new dependencies or database migrations.

The supplied mockup is a design reference, not a set of implemented features. Financials, equipment, analytics, communications, notifications, global search and fictional attendance/progress are not added. The real application uses available authorized records instead of decorative mockup projects/photos.

## Verification

Existing document, scheduling, field-reliability, operational, core-job, job-desk, Ask Stage 3 and lexical regression suites passed. Browser testing uses the retained isolated Supabase stack on loopback only, with synthetic companies/projects. No production access or hosted tests.

Desktop checks: dashboard, project list/overview/tabs, company calendar month/week/day and navigation/filtering, persisted activity edit and task creation. Mobile checks: report-and-crew save with actual confirmation, document upload/promotion and safe cancellation of archive confirmation. Pending controls stayed pending until writes were confirmed. A legacy mobile-header color conflict was discovered visually and corrected before the final build. Final built preview verified mobile header contrast, Resources navigation/disclosure closure, saved document retrieval, and month-to-day drilldown. Schedule and document pages have no horizontal overflow at 320px; report and document detail pages fit 390px. Sign-out reaches the redesigned login; keyboard Tab exposes a visible focus outline. Desktop authentication artwork is decorative and the page fits its 1280px viewport.

Before/after screenshots in `docs/visual-evidence/` capture the real built applications using isolated records, not static mockups. Baseline comes from validated Sprint 5; transformations come from Sprint 6. No physical-device testing is claimed.

## Release dependencies and limitations

Draft engineering review only. Ordered release remains Sprint 3 → Sprint 4 → Sprint 5 → Sprint 6. Retarget after earlier releases/ancestry review. Production backup/recovery remains unresolved. No merge, production access, migration or deployment is authorized. Sprint 6 adds no database migration; earlier migrations retain their approved release/cutover and verifier prerequisites.

Physical devices, real cellular conditions, broad assistive-technology/screen-reader certification and large-company load remain outside this visual sprint. Existing pagination, storage lifecycle and non-PDF processing limitations are unchanged. Next recommended work is contractor pilot usability review and focused refinement from actual customer feedback, not new architecture or analytics.

## Final quality gates

- TypeScript: passed (`tsc --noEmit`).
- ESLint: passed with one existing unused `tokenize` warning in `lib/ask-stage4e-fts-experiment1.ts:197`.
- Supported webpack production build: passed.
- Documents, scheduling, field reliability, operations, core-job, job-desk, Ask and lexical automated regression commands: passed.
- Authenticated built-app HTTP acceptance: passed document/detail/project/task/schedule rendering and Company B document detail/file denial.
- Browser: desktop calendar navigation/filter/edit/save and task save; emulated mobile report+crew confirmed save, PDF upload verification, explicit version promotion, archive-confirmation cancellation, metadata search, resource navigation and narrow calendar drilldown passed. Reload confirmed persisted document state. Loading and pending states were observed before success.
- No new migration or database permission changes; a fresh database replay and exhaustive prior CRUD/failure matrix were not repeated for this presentation-only diff. Earlier Sprint 3–5 acceptance remains the baseline. No new claim of interrupted-upload/rollback testing is made by this sprint.

## Visual evidence

Baseline: [dashboard](visual-evidence/dashboard-before.jpg), [schedule](visual-evidence/schedule-before.jpg), [mobile schedule](visual-evidence/schedule-mobile-before.jpg).

Sprint 6: [dashboard](visual-evidence/dashboard-after.jpg), [project](visual-evidence/project-after.jpg), [schedule](visual-evidence/schedule-after.jpg), [mobile schedule](visual-evidence/schedule-mobile-after.jpg), [mobile report](visual-evidence/report-mobile-after.jpg), [documents](visual-evidence/documents-after.jpg), [authentication](visual-evidence/auth-after.jpg). All records shown are isolated synthetic fixtures.
