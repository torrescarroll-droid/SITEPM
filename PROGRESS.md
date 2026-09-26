SITEPM Progress

Week 1 — Development Environment & Version Control

Status: COMPLETE ✅

Done
- SITEPM runs locally
- Cursor connected to SITEPM project
- Git working
- GitHub Desktop connected
- GitHub repository published
- Test code change created
- Test change committed and pushed
- Previous version successfully restored

Next
- Week 2: Build responsive SITEPM UI shell
- Dashboard
- Projects
- Ask SITEPM
- Documents
- Field
- Tasks

Blocked
- None

Week 2 — UI Shell

Status: READY FOR REVIEW

Done
- Responsive app shell (desktop sidebar, phone bottom nav)
- Dashboard, Projects, Project Detail, Ask SITEPM, Documents, Field, and Tasks screens with demo data
- No Supabase, auth, AI, or uploads connected
- App running locally for review

Next
- Review UI shell at phone and desktop widths
- Then commit Week 2 when approved

Blocked
- None

Week 3 — Database

Status: IN PROGRESS — ready for review

Done
- Core tables created in Supabase (companies, profiles, projects, tasks, field_logs)
- Row Level Security enabled; no anon/public policies
- Persistence verified in the Supabase Table Editor
- App uses server-only Supabase client from .env.local
- Connection check hits Auth health only (no table reads/writes)

Next
- Week 4: authentication and company-scoped RLS policies
- Then load real project/task/field data in the app

Blocked
- None

Week 4 — Authentication & Security

Status: IN PROGRESS — ready for review

Done
- Cookie-based sign up, login, and logout (server actions; no service-role key)
- Signup sends company_name and full_name in Auth metadata for the Week 4 trigger
- Logged-out users are redirected to /login
- Shell shows the signed-in profile/company from RLS and a Log out control
- Ask SITEPM, Documents, and AI still demo-only

Blocked
- None

Sunday, Sep 13, 2026 — end of day checkpoint

Status: STOPPED FOR THE DAY — do not commit

Done
- Week 4 SQL migration (`sql/week4_auth_rls.sql`) ran successfully in Supabase
- Application auth slice exists: cookie signup/login/logout, metadata for the company/owner trigger, logged-out users sent to /login
- Week 4 authentication and tenant-isolation tests have NOT been run yet

Next
- Manually test signup, login, logout
- Manually test Company A vs Company B isolation
- Do not commit or push until those Week 4 tests pass

Blocked
- Commit of Week 4 work until authentication and tenant-isolation tests pass

Wednesday, Sep 16, 2026 — Auth + RLS + project persistence

Status: IN PROGRESS — ready for manual auth and isolation tests. Do not commit.

Done
- Inspected existing Week 4 auth (route groups, middleware, SSR cookies, signup/login/logout, week4_auth_rls.sql)
- Confirmed no anonymous RLS policies and no NEXT_PUBLIC_ / service-role usage in the app
- Authenticated users load company from profiles via current_company_id() / requireCompanyContext()
- Projects create/list/detail persist in Supabase (company_id taken from the signed-in profile only)
- Dashboard Active projects uses live company jobs; briefing/tasks/field on the dashboard remain demo
- Project tabs render for live project IDs (no longer keyed only to demo-data ids)
- Ask SITEPM, Documents, Field, and Tasks still demo-only under a live project record

Current architecture
- auth.users → profiles (auth_user_id) → companies → projects
- Middleware refreshes the session cookie and redirects logged-out users to /login
- Server components/actions use @supabase/ssr with SUPABASE_URL + SUPABASE_ANON_KEY from .env.local
- RLS: authenticated policies only; company_id = current_company_id(); no anon SELECT/INSERT/UPDATE

Authentication status
- Signup, login, logout, and protected-route redirects are implemented
- If Confirm email is on, signup may create the user without a session until the user confirms
- End-to-end login/logout/re-login has not been manually verified in this session

Supabase / database status
- Week 3 tables remain; Week 4 SQL already applied (trigger, current_company_id, RLS)
- No new tables in this pass

RLS / security status
- App never sends company_id from the client form
- List/get also filter .eq("company_id", profile.company_id)
- Cross-company project IDs should 404 via empty RLS + maybeSingle
- Manual Company A vs Company B test still required

Project persistence status
- Vertical slice: signed-in user → company/profile → create project → list → detail
- Logout/login persistence depends on the same Auth user + profile (expected; untested here)

Files changed this session
- lib/auth-context.ts (new)
- lib/projects.ts (new)
- lib/project-actions.ts (new)
- app/(app)/page.tsx
- app/(app)/projects/page.tsx
- app/(app)/projects/new/page.tsx
- app/(app)/projects/[id]/page.tsx
- app/(app)/projects/[id]/ask/page.tsx
- app/(app)/projects/[id]/documents/page.tsx
- app/(app)/projects/[id]/field/page.tsx
- app/(app)/projects/[id]/tasks/page.tsx
- components/project-tabs.tsx
- PROGRESS.md

Tests / checks run
- npx tsc --noEmit (pass after next build refreshed .next/types)
- npx eslint . (pass)
- npx next build (pass)
- No app test suite present
- Browser signup/login/create-project/isolation not run

Remaining blockers
- Manual tests: signup, login, create project, logout, login again, same project visible
- Manual tests: second company cannot open first company’s project URL
- Confirm email setting in Supabase Auth may block immediate session after signup
- Week 4 still uncommitted until those tests pass (per earlier instruction)

Next recommended task
- With Confirm email off (or after confirming the inbox), sign up Company A, create a project, log out, log back in, confirm the job remains. Then sign up Company B and confirm Company A’s project id returns not found. Then commit Week 4.

Wednesday, Sep 16, 2026 — isolation test attempt

Status: BLOCKED on Supabase Confirm email

Done
- Browser signup for Company A created the Auth user
- Signup returned: confirm email, then log in
- Login returned: Email not confirmed
- Project create, persistence after logout, and Company B isolation were not reached
- No service-role key in .env.local, so the test cannot confirm the user from the app

Next
- In Supabase: Authentication → Sign In / Providers → Email → turn Confirm email off (local testing), or confirm the user in Authentication → Users
- Re-run Company A / Company B isolation

Blocked
- End-to-end isolation test until the Company A user can obtain a session

Wednesday, Sep 16, 2026 — isolation test passed

Status: READY TO COMMIT (not committed in this session)

Done
- Confirm email off; fresh Company A and Company B accounts
- Company A signup created a session (shell: Alex Rivera / Company A Isolation / owner)
- Created live project “184 Maple Isolation Job” (id 3fb9aa08-44ae-49bb-80f3-2809b8cb5f4f)
- Project appeared on Jobs and Dashboard Active projects
- Logout / login as Company A: same project still listed and URL still loaded
- Company B signup (Jordan Chen / Company B Isolation): Jobs empty, dashboard had no Company A job
- Company B opening Company A URL returned 404 while still signed in as Company B
- Isolation is RLS + company_id query in getAuthorizedProject → notFound; not UI-only hiding

Authentication / persistence / RLS
- Auth cookies work; project persisted in Supabase
- Cross-company SELECT did not return the row to the app (404, not leaked overview)

Checks
- Browser end-to-end isolation test passed
- No RLS weakening and no service-role key added

Next
- Commit Week 4 auth + company-scoped project persistence when instructed

Blocked
- None for this milestone. Ask/Documents/Field/Tasks remain demo. Dev overlay showed a hydration warning on AppShell/login (non-blocking for this test).

Week 4 checkpoint — verified acceptance (Wednesday, Sep 16, 2026)

Status: PASSED — ready to commit (this commit)

Verified
- Signup works
- Login works
- Logout works
- Authenticated sessions work
- Company/profile relationship works
- Real project creation works
- Projects persist in Supabase
- Project list uses live data
- Dashboard Active Projects uses live data
- Project survives logout/login
- Company B cannot see Company A projects
- Company B cannot access Company A project by direct UUID URL
- Cross-company protection exists at both application query and Supabase RLS layers
- TypeScript passed
- ESLint passed
- Production build passed

Isolation evidence
- Company A: Company A Isolation; project “184 Maple Isolation Job”
- Company B: Company B Isolation; Jobs empty; Company A UUID URL returned 404
- Protection: RLS (`company_id = current_company_id()`) plus server queries scoped to the signed-in profile company

Not in this checkpoint
- Tasks, Field, Documents, and Ask SITEPM remain demo (not migrated)

Next
- Push only after explicit approval

Blocked
- None for the Week 4 auth + project persistence checkpoint

Week 5 — Project-scoped tasks

Status: READY FOR REVIEW — do not commit until week5 SQL is applied in Supabase

Done
- Live tasks on project Tasks tab and global Follow-ups
- Create, edit, mark done/reopen, delete UI (delete needs Week 5 GRANT)
- Dashboard overdue tasks from Supabase (done tasks are not overdue)
- Project overview open-task count from live tasks
- App authorizes via profile company + project membership; company_id not taken from the client as the boundary
- sql/week5_task_rls.sql written: align company_id from parent project; SELECT/INSERT/UPDATE/DELETE require current_company_id() and matching project; no anon policies

Schema
- Existing public.tasks table used (no duplicate table)
- No new columns (no updated_at; completed_at used for done)

RLS
- Week 4 already had authenticated company_id policies for select/insert/update
- Week 5 SQL tightens WITH CHECK to the parent project and adds DELETE — file is in the repo, not yet executed in the Supabase SQL editor

Persistence tests (Company A Isolation, project 184 Maple Isolation Job)
- Created “Confirm isolation panel follow-up” (id 3e45b9ad-ae72-4b38-8832-b450ec420b6b)
- Reload: task remained
- Edited title to “…(edited)”: persisted
- Mark done: persisted (status done, Reopen shown)
- Logout / login: edited done task still on Follow-ups

Isolation tests (Company B Isolation)
- Global Tasks: No tasks yet (Company A task not listed)
- Direct Company A project tasks URL: 404
- Create form as B has no Company A project (no jobs)
- App createTask rejects unauthorized project_id (“not available to your company”)
- Direct update/delete as B not exposed in UI (no task row / 404)

Dashboard
- Overdue tasks live; after marking A’s task done, Home showed “No overdue tasks.”
- AI briefing and field activity still demo

Validation
- npx tsc --noEmit passed
- npx eslint . passed
- npx next build passed

Files
- sql/week5_task_rls.sql
- lib/tasks.ts, lib/task-types.ts, lib/task-actions.ts, lib/format-date.ts
- components/task-list.tsx
- app/(app)/tasks/page.tsx, app/(app)/projects/[id]/tasks/page.tsx
- app/(app)/projects/[id]/page.tsx, app/(app)/page.tsx
- lib/projects.ts (findAuthorizedProject)

Remaining demo
- Ask SITEPM, Documents, Field, AI briefing

Next recommended task
- Run sql/week5_task_rls.sql in the Supabase SQL editor, then re-test Delete and a forged insert against another company’s project_id at the database
- Then Field logs (same pattern as tasks), not Documents/Ask yet

Blocked
- Week 5 SQL not applied in the hosted Supabase project from this session (no service-role / SQL runner)
- Do not commit until that SQL is applied if DELETE + project-bound WITH CHECK should be in the same checkpoint

Security checkpoint — Saturday, Sep 19, 2026

Status: Week 4 security gate PASSED

Done
- Supabase authentication implemented
- Cookie-based authenticated sessions implemented
- Each signup creates its own company and owner profile
- RLS is enabled and company-scoped
- Company A/B tenant isolation was tested directly against Supabase using a live Company A task
- Company B was unable to SELECT, UPDATE, or DELETE the known Company A task even with its exact UUID
- Company B could not create a task against Company A’s project
- Company A retained access; the temporary isolation task was cleaned up afterward
- Live-row task id used in the final check: 8066a269-6004-4a43-9108-50deee7d0a33
- After cleanup, Company A has no remaining isolation/probe tasks
- Week 4 SQL (`sql/week4_auth_rls.sql`) and Week 3 SQL (`sql/week3_core_tables.sql`) are in the repository
- Week 5 task RLS SQL (`sql/week5_task_rls.sql`) is applied in Supabase and tracked
- No service-role key in tracked files; `.env.local` and `.next/` are gitignored

Next
- Continue SITEPM_BUILD_SPEC.md Week 5 (Projects end-to-end): project edit, close, and reopen, then live field logs on the same company/project RLS pattern
- Do not start Week 6 Documents until that Week 5 remainder is done

Blocked
- None for the Week 4 security gate

Architecture documentation pass — Saturday, Sep 19, 2026

Status: DOCUMENTATION ONLY — no MVP behavior change, no Field Logs, not committed

Done
- Documented SITEPM as construction data + operating infrastructure; AI models are not the moat
- Recorded current wedge: Projects → Tasks → Field Logs → Documents → Ask SITEPM
- Documented future product family, Construction Graph (conceptual Postgres), ingest pipeline, provenance, privacy classes A–D, agent/API, and flywheel
- Created `docs/PRODUCT_ARCHITECTURE.md`, `docs/DATA_INGESTION_ARCHITECTURE.md`, `docs/DATA_SOURCE_REGISTRY.md`
- Added `.cursor/rules/sitepm-long-term-architecture.mdc` and a short pointer in `AGENTS.md`

Next
- After review of these docs: implement Field Logs on the existing `field_logs` table and company/project RLS (SITEPM_BUILD_SPEC.md Week 5 remainder / next product milestone)
- Do not ingest external datasets until registry entries are license-reviewed

Blocked
- None for this documentation pass. External source reuse remains RESEARCH REQUIRED.

Field Logs implementation — Saturday, Sep 19, 2026

Status: APP IMPLEMENTED — not committed. Company/project RLS SQL written but NOT applied. Tenant isolation acceptance is blocked until SQL is approved and run.

Done
- Live Field Logs on existing `field_logs` columns: `project_id`, `company_id` (server profile, not browser), `log_date`, `notes`, `issue_flag`, `created_by`
- Company Field page and project Field tab: create form + newest-first list, empty states
- Dashboard “Recent field activity” uses live company logs (AI briefing remains demo)
- App create path authorizes the project server-side via `findAuthorizedProject`
- Added `sql/week5_field_log_rls.sql`: align `company_id` from parent project; SELECT/INSERT/UPDATE require company match AND parent project in the same company
- Edit/delete not implemented: spec Field workflow is create-focused; Week 4 grants UPDATE but not DELETE; no DELETE policy added
- Photos/voice/AI not implemented (`photos` table is not in Week 3 schema)
- Typecheck (`tsc --noEmit`), ESLint, and `next build` passed
- No automated test suite in the repo
- Isolation A–G not run (waiting on SQL apply)

Next
- Apply `sql/week5_field_log_rls.sql` in the Supabase SQL editor, then run Company A/B field-log isolation (create persist, B cannot SELECT by id or list, B cannot open A project Field route, forged B insert on A `project_id` returns 42501, cleanup)
- Do not start Documents or Ask SITEPM until that gate passes

Blocked
- Field log parent-project RLS is not live until `sql/week5_field_log_rls.sql` is applied. Current hosted policies are still Week 4 company-id-only for `field_logs`.

Field Logs RLS gate + isolation — Saturday, Sep 19, 2026

Status: APP + RLS APPLIED — isolation A–E passed at the database. Not committed.

Done
- Confirmed `sql/week5_field_log_rls.sql` was applied in Supabase (restored the file in the repo after it had been missing from disk)
- Direct authenticated Supabase-js tests (anon key + Company A/B user JWTs; no service-role; not app form validation)
- A. Company A inserted a field log on `184 Maple Isolation Job` (`3fb9aa08-44ae-49bb-80f3-2809b8cb5f4f`) and it persisted as `26c75b7b-3929-4f01-89bc-9fbadc99b946`
- B. Company B SELECT of that exact id returned no row and no error (RLS filter)
- C. Company B field_logs list count 0; did not include the Company A log
- D. Company B SELECT of Company A project id returned no row; `/projects/[id]/field` uses `getAuthorizedProject` → `notFound()`
- E. Company B INSERT with Company B `company_id` + Company A `project_id` rejected by Postgres RLS: code `42501`, message `new row violates row-level security policy for table "field_logs"`
- F. App has no edit/delete. Extra DB check: Company B UPDATE of the Company A log returned 0 rows; Company B DELETE returned `42501` permission denied for table `field_logs` (DELETE is not granted)
- A still saw the unmodified probe notes after B’s probes
- Typecheck (`tsc --noEmit`) pass; ESLint pass; `next build` pass
- No test suite in the repo
- No service-role in tracked files; `.env.local` gitignored; isolation script not tracked

Cleanup
- Authenticated DELETE of the probe log failed with `42501` permission denied (no DELETE grant, by design)
- Temporary Company A field log still present: `26c75b7b-3929-4f01-89bc-9fbadc99b946`
- Company B has 0 matching probe rows
- Delete that row in the Supabase Table Editor / SQL editor as the table owner. Do not grant DELETE to `authenticated` just for cleanup unless a later reviewed change adds field-log delete

Next
- Review this Field Logs slice, then commit if accepted
- Do not start Documents or Ask SITEPM until that review

Blocked
- Owner-side delete of probe log `26c75b7b-3929-4f01-89bc-9fbadc99b946` (no authenticated DELETE privilege)

Field Logs checkpoint — Saturday, Sep 19, 2026

Status: ACCEPTED for commit — A–E passed; probe log removed by table owner; DELETE privilege unchanged

Done
- Remaining Company A acceptance-test field log `26c75b7b-3929-4f01-89bc-9fbadc99b946` was deleted in the Supabase SQL Editor
- Authenticated DELETE is still not granted; field-log delete is not part of this MVP
- Isolation A–E stand: persist, B cannot SELECT by id, B cannot list, B cannot load A’s project Field route, forged B insert on A `project_id` is Postgres `42501`
- Diff is Field Logs app + `sql/week5_field_log_rls.sql` + append-only PROGRESS.md; Documents and Ask SITEPM remain demo

Next
- Push this Field Logs commit when asked
- Then Documents (not started)

Blocked
- None for the Field Logs checkpoint

Week 6 Documents — Saturday, Sep 19, 2026

Status: APP + SQL WRITTEN — not applied to hosted Supabase. Isolation not run. Not committed.

Done
- Added `sql/week6_documents.sql`: `documents` table, parent-project company alignment, staged `pending`/`ready`/`failed` status, private `project-documents` bucket, table RLS, Storage SELECT/INSERT only
- No authenticated DELETE on documents or Storage; no Storage UPDATE
- App: company and project Documents pages, PDF upload, list ready rows only, 60s signed open
- Failed Storage upload marks the row `failed` (not listed/openable); success requires `ready`
- Next.js `serverActions.bodySizeLimit` set to 21mb for 20 MiB PDFs

Next
- Apply `sql/week6_documents.sql` in the Supabase SQL editor
- Then Company A/B isolation including Storage object and signed-URL denial
- Do not start Ask SITEPM

Blocked
- Hosted table/bucket/RLS not live until the SQL is applied. Do not claim Storage isolation until that gate and A/B tests pass.

Week 6 Documents isolation — Saturday, Sep 19, 2026

Status: SQL APPLIED — table RLS isolation passed; Storage owner upload FAILED (403 policy). Isolation NOT fully accepted. Not committed.

Done
- Authenticated A/B tests used user JWTs + anon key. No service-role. DELETE/Storage UPDATE not granted.
- `documents` table is live: A can SELECT/INSERT pending; INSERT `status=ready` is `42501`
- Company B cannot SELECT A metadata by id, list A docs, SELECT A project, or INSERT onto A `project_id` (`42501`)
- B DELETE row: `42501` permission denied; B Storage remove returned 0 objects
- Anon SELECT documents: `42501`
- Failed-state: pending/failed excluded from ready list; failed→ready blocked (`Failed documents cannot change status`)
- Company A Storage upload to own path was **rejected** (`AccessDenied` / row-level security). No object was stored. Signed URL for A failed (`NoSuchKey`)
- B Storage download/signed-URL failures were `NoSuchKey` because the object does not exist — not a complete Storage ACL proof
- Typecheck, ESLint, `next build` re-run after tests

Cleanup required in Supabase (no authenticated DELETE):
- documents `68362d9e-1ec4-4d52-9d94-46a669417d7d` status ready, path `b3899021-1203-47b7-8475-4c525bf9d4af/3fb9aa08-44ae-49bb-80f3-2809b8cb5f4f/68362d9e-1ec4-4d52-9d94-46a669417d7d/SITEPM isolation contract.pdf` (no Storage object)
- documents `4451f64d-ec5f-4fb0-b307-97ec87fa174b` status failed, path `b3899021-1203-47b7-8475-4c525bf9d4af/3fb9aa08-44ae-49bb-80f3-2809b8cb5f4f/4451f64d-ec5f-4fb0-b307-97ec87fa174b/SITEPM isolation contract.pdf` (no Storage object)

Next
- Diagnose why `storage.objects` INSERT WITH CHECK rejects the owner’s own `{company}/{project}/{document}/{file}.pdf` path
- Do not loosen policies for B; fix owner-write if `current_company_id()` / `projects` visibility is broken inside Storage RLS
- Re-run Storage upload, signed URL, and B object-denial tests after that
- Do not start Ask SITEPM

Blocked
- Company A cannot store a PDF until Storage INSERT works for the owner

Week 6 Documents Storage isolation (after RLS fix) — Saturday, Sep 19, 2026

Status: A succeeds at database + Storage. B denied at database (`42501`) and Storage (403 write / 404 hidden read). Not committed.

Done
- Applied `sql/week6_storage_rls_fix.sql` (user). Re-ran user-JWT isolation; no service-role; no DELETE/UPDATE grants
- A pending insert → Storage upload → ready; A listed ready row; A 60s signed URL retrieved the PDF (HTTP 200)
- B cannot SELECT/list A metadata; cannot SELECT A project; forged INSERT `42501`; mix company B prefix + A project Storage `403`; mix metadata `42501`
- B Storage upload into A namespace `403`; overwrite `403`; row DELETE `42501`; Storage remove 0 objects
- B download/signed URL for A object: `NoSuchKey` 404 (object exists for A signed fetch)
- Anon documents SELECT `42501`; anon Storage `NoSuchKey`
- Failed/pending not listed as ready; failed→ready blocked `P0001`
- Typecheck, ESLint, `next build` pass; Projects/Tasks/Field Logs SQL/app files untouched

Cleanup (owner SQL/Storage UI):
- ready document + object `a14f5611-01f0-43e3-9df0-f0f61dd4c82e` path `b3899021-1203-47b7-8475-4c525bf9d4af/3fb9aa08-44ae-49bb-80f3-2809b8cb5f4f/a14f5611-01f0-43e3-9df0-f0f61dd4c82e/SITEPM isolation contract.pdf`
- failed metadata only `77efa0a9-68d9-45ec-9a7b-007088431a1a` path `…/77efa0a9-68d9-45ec-9a7b-007088431a1a/SITEPM isolation contract.pdf` (no object)

Next
- Review Documents milestone and commit if accepted
- Do not start Ask SITEPM

Blocked
- None for Storage owner upload. Bucket list API is not exposed to authenticated users (GET `/storage/v1/bucket` empty); privacy is evidenced by signed-URL-only reads.

Week 6 Documents — final checkpoint — Saturday, Sep 19, 2026

Status: ACCEPTED — database + Storage tenant isolation passed. Canonical SQL is `sql/week6_documents.sql`.

Done
- Company A can insert pending metadata, upload into private `project-documents`, and move pending → ready
- Company A can list ready documents and open them via a 60s signed URL (user JWT; no service-role)
- Company B cannot read A metadata, access A project Documents, upload/read/sign A objects, mix B company prefix with A project id, or forge A metadata (`42501` / Storage `403` write / `404` hidden read)
- Storage overwrite/update denied; authenticated document and Storage DELETE denied; anonymous metadata/Storage denied
- Pending/failed are not listed or opened as ready; failed is terminal (`P0001`)
- `project_document_object_allowed()` uses `auth.uid()` + `current_company_id()`; Storage SELECT/INSERT only; no UPDATE/DELETE policies
- Test artifacts cleaned by the database/Storage owner
- Removed temporary `sql/week6_storage_rls_fix.sql` and `sql/week6_storage_rls_diagnose.sql`; their accepted Storage helper/policies live in `sql/week6_documents.sql`
- Projects, Tasks, and Field Logs were not changed; Ask SITEPM was not started

Next
- Do not start Ask SITEPM
- Do not begin architecture expansion

Blocked
- None

Post-Week-6 architecture expansion — Saturday, Sep 19, 2026

Status: DOCUMENTATION ONLY — long-term architecture updated. No application, SQL, RLS, or package changes. Not committed.

Done
- Recorded living Property Record, document intelligence, Construction vs Regulatory knowledge, English/Spanish field bridge, evidence/provenance-first intelligence, Ask knowledge classes, and replaceable-model strategy in architecture docs
- Distinguished current implemented state (Projects, Tasks, Field Logs, Documents), next MVP (Ask SITEPM V1 over Project Knowledge), long-term architecture, and future research/data acquisition
- Did not acquire external datasets or claim code/standards licenses
- Did not implement property schema, Ask SITEPM, or RLS changes

Next
- Recommended implementation milestone: Ask SITEPM / Intelligence V1 over existing secure project records (`SITEPM_BUILD_SPEC.md` Weeks 7–8)
- Do not start Ask SITEPM until explicitly authorized
- Do not begin Property schema or knowledge-corpus ingest

Blocked
- None for documentation. External source licensing remains RESEARCH REQUIRED.

Architecture checkpoint — Saturday, Sep 19, 2026

Status: ACCEPTED documentation checkpoint. Local commit only.

Done
- Reviewed documentation-only diff against `f3f612c` (`feat: add secure project documents`)
- No application, SQL, RLS, dependency, or Ask SITEPM implementation changes
- Long-term Property/knowledge architecture recorded; Ask SITEPM V1 remains project-grounded

Next
- Dedicated Ask SITEPM / Intelligence V1 design review before coding
- Do not implement Ask SITEPM until that review authorizes it

Blocked
- None

Ask SITEPM V1 Stage 1 — Saturday, Sep 19, 2026

Status: Stage 1 foundation implemented. Ask SITEPM V1 is NOT complete. No AI provider.

Done
- Replaced demo Ask with authenticated, project-authorized `/projects/[id]/ask` and a company project picker at `/ask`
- Ask form authorizes the project server-side before any future retrieval/model step; Stage 1 returns a connection notice only (no simulated answers)
- Project-scoped retrieval invariant helpers added for Stage 2 (on top of existing company RLS; RLS unchanged)

Next
- Stage 2: structured Project/Task/Field Log retrieval for the authorized project only
- Stage 3: replaceable model + evidence/provenance
- Stage 4: PDF intelligence
- Do not mark Ask SITEPM V1 complete

Blocked
- None for Stage 1

Ask SITEPM V1 Stage 2 — Saturday, Sep 19, 2026

Status: Stage 2 deterministic project-scoped retrieval implemented. Ask SITEPM V1 is NOT complete. No AI provider.

Done
- Ask retrieves Project Knowledge for the authorized project only: project record, tasks, field logs, ready document metadata (no PDF bytes, no signed URLs, no `storage_path` in evidence)
- Retrieval sequence: session → company → re-authorize project → user-scoped list helpers → assert project (and company) scope → normalize evidence → citation allowlist (`type:id`)
- Same-company isolation is enforced in application logic on top of existing RLS (unchanged)
- Stage 1 connection notice remains; UI shows evidence counts only, not generated answers
- Stage 2 acceptance-test fixtures were removed by the database/Storage owner

Next
- Stage 3: replaceable model + epistemic answers + allowlist-validated citations
- Stage 4: PDF intelligence
- Do not mark Ask SITEPM V1 complete

Blocked
- None for Stage 2

Builder-first / Digital Toolbag architecture refinement — Sunday, Sep 20, 2026

Status: DOCUMENTATION ONLY. MVP scope not expanded. Ask Stage 2 remains complete. Ask Stage 3 has NOT started. Not committed.

Done
- Locked canonical product true north in `docs/PRODUCT_ARCHITECTURE.md`: builder-first Digital Toolbag over Construction Operating System; complexity inside SITEPM
- Complementary true north: more capability for the person who builds, more leverage for the person who runs the job, more control for the person who runs the company — increasing depth of one system
- SITEPM scales with the builder, not away from the builder; builder-first does not mean field-worker-only
- Solo builders/tradespeople recorded as first-class potential paying buyers (distinct from users); 3–25 / office-PM GC remains an important MVP segment
- Voice/vehicle-first interaction and Truck Test recorded as strategic UX, not implementation
- Language-independent construction intelligence: work in your language; common authorized meaning underneath; English-complete and Spanish-complete
- Translation beyond human language (field ↔ PM, craft ↔ structured data, client intent ↔ scope, etc.)
- Conversational estimating/takeoff/pricing and estimate-vs-actual learning loop recorded as long-term Estimate domain
- Digital Toolbag vs Construction OS two-layer model; canonical stack Toolbag → AI Project Manager → OS → Business/Property/Historical Intelligence → Agent/API
- Original opportunity map preserved (not in MVP ≠ dropped)
- Builder–Technology Gap: digital literacy is not a prerequisite; native-English low-computer-literacy builders are in the same class as Spanish-only builders; language is one part of a larger gap
- Natural construction input pipeline; Field-to-Office Pipeline: field talks about the work; SITEPM builds the report and structured state (report is not the end product)
- Two-way field intelligence (Field → Project and Project + Construction Knowledge → Field); Jobsite Copilot / field assistance with safety/escalation boundaries
- Field knowledge extraction as moat: permissioned provenance-aware history, not transcription or report generation
- SITEPM as workforce capability multiplier (does not replace builder knowledge)
- Contractor maturity / product depth (levels 1–6, not pricing, not separate products); solo contractor as Toolbag ↔ AI PM bridge
- Construction Spectrum; bidirectional knowledge bridge; same truth / different representations (SOURCE → FACT → DERIVATION → PRESENTATION)
- Client / non-construction participant as future surface, not MVP
- Internal “As Above, So Below” system-fractality principle (not customer-facing)
- Full worker → project → company → property → agent/API span; architecture breadth ≠ MVP breadth
- Current implementation sequence unchanged; no application/SQL/RLS/package changes

Next
- Ask SITEPM V1 Stage 3 only when separately authorized (model + provenance over Stage 2 evidence)
- Do not implement Digital Toolbag runtime, voice OS, Field-to-Office Pipeline, Jobsite Copilot, estimating, or communications from this architecture pass

Blocked
- None for documentation. Pricing tiers, commercial name, and voice-provider choice remain unresolved.

Ask SITEPM V1 Stage 3 — Sunday, Sep 20, 2026

Status: IMPLEMENTED — ready for review. Not committed. **Not marked complete.** Live provider auth now works (`gpt-4o-mini`). Grounded task/log/document/insufficient/inference/citation/injection live checks passed. Company A/B isolation and signed-in browser Ask remain BLOCKED (`SITEPM_ISO_*` unavailable). Ask Stage 4 not started.

Done
- Replaceable server-only OpenAI Chat Completions boundary (`lib/ai/provider.ts`) over existing Stage 2 evidence retrieval; no SDK, LangChain, vectors, web search, or tools
- Authorization still runs before any provider call (`requireAuthorizedAskProject` → `retrieveAskProjectEvidence` → model)
- Evidence is delimited as untrusted DATA; system prompt is static and does not interpolate task/log/filename bodies
- Application-controlled citation allowlist: unknown, malformed, fabricated, and other-project citations are dropped and never rendered as trusted sources
- Insufficient-evidence / epistemicKind fields; document metadata only (no PDF bytes, signed URLs, or extraction)
- Read-only: Ask does not create/update tasks, logs, projects, or send messages
- Unit checks (`npm run test:ask`): citation gate, injection-as-data, form project id ignores question text, missing API key fails closed
- Live `gpt-4o-mini` grounded checks passed for task, field-log, document metadata (no PDF contents), insufficient evidence, inference labeling, cross-project non-retrieval, and injection-as-data
- Action path remains read-only; model did not claim to create/send; live harness wording regex was overly strict
- TypeScript, lint, and production build passed

Next
- Provide `SITEPM_ISO_*` to the test process (without displaying secrets) and re-run Company A/B plus signed-in Ask browser smoke
- Ask Stage 4 (PDF intelligence) only when separately authorized
- Do not implement Digital Toolbag runtime, voice OS, Field-to-Office, Jobsite Copilot, estimating, or communications

Blocked
- Live Company A/B JWT isolation: `SITEPM_ISO_*` not available to the test process
- Signed-in browser Ask smoke: redirected to `/login`; isolation logins not used because those credentials were not in the test process

Ask SITEPM V1 Stage 3 acceptance — Monday, Sep 21, 2026

Status: Stage 3 implementation accepted for review. **Not marked complete as a product (Ask SITEPM V1 still needs Stage 4).** Not committed. Ask Stage 4 not started. No SQL/RLS/Auth/Storage/authorization changes in this pass.

Done
- Re-ran `scripts/ask-stage3-isolation.mjs` after Company A gained a second project: Company A can read Project A; Company B cannot read Project A or its tasks; same-company Project A filter executed (did not SKIP) and passed
- Signed-in Company A Ask on Project A: distinctive Project A evidence answered in-scope; Project B–only question returned insufficient evidence with Project A counts only; unsupported question returned insufficient evidence (no invented facts)
- Signed-in Company B via `/login` received HTTP 404 on Company A’s Project A Ask URL; page did not show Project A name or records
- `npm run test:ask` passed; `npx tsc --noEmit` passed; `npm run lint` passed; `npm run build` passed

Next
- Ask Stage 4 (PDF intelligence) only when separately authorized
- Optional: store `SITEPM_ISO_PROJECT_A` as the project UUID (the saved value is still not a UUID, so the isolation script without a UUID override fails the two `projects.id` reads)
- Optional: action-boundary live harness regex is overly strict (model restated facts without claiming a write); do not change the regex merely to obtain a pass

Blocked
- None for Stage 3 application/security behavior. Remaining items are test-config (`SITEPM_ISO_PROJECT_A` not a UUID in saved env) and the previously identified action-boundary harness wording check

Ask SITEPM V1 Stage 3 closure — Monday, Sep 21, 2026

Status: **Stage 3 accepted.** Checkpoint authorized. **Ask SITEPM V1 is still not complete** because Stage 4 (PDF intelligence) has not started. No SQL/RLS/Auth/Storage/authorization/application/test-expectation changes in this pass.

Done
- Unmodified `node scripts/ask-stage3-isolation.mjs` against saved env (no Project A override): Company A → Project A PASS; Company B → Project A isolation PASS; same-company Project A vs Project B PASS (did not SKIP)
- Prior signed-in Ask, 404 cross-company Ask, unit, TypeScript, lint, and production-build acceptance remains in force

Next
- Ask Stage 4 (PDF intelligence) only when separately authorized

Blocked
- None for Stage 3 application/security. Non-blocking test-harness debt: live action-boundary regex is overly strict (model restated facts; no mutation or false write claim). Do not change the regex merely to obtain a pass.


Living Property Record requirements + Reference Project 001 — Friday, Sep 25, 2026

Status: DOCUMENTATION / OFFLINE FIXTURE ONLY — ready for review; not committed or pushed. Accepted Stage 3 checkpoint `97940b3` preserved. Ask Stage 4 has not started.

Done
- Inspected clean `main`/`origin/main` state, recent history, AGENTS.md, build spec, canonical architecture/progress documents and Cursor architecture rule; reviewed Ask authorization/retrieval/citation/provider boundaries, ready-document queries and existing SQL policy definitions.
- Extended Product Architecture §20 with lifecycle capture/handoff, dated property/area/system/component relationships, contractor/contracts/contact history, evidence authority, source → inference → answer, service/replacement history and Class B/Class C boundaries.
- Extended Data Ingestion Architecture and Cursor rule with lifecycle provenance requirements and offline fixture/ground-truth separation.
- Created `docs/reference-projects/001/`: 15 fictional Markdown source documents, README, source-register.json, ground-truth.json (18 questions), and offline validate.py. Covers high-end residential remodel/addition, revised radiant manifold/ports, installation/test/closeout evidence, subsequent actuator replacement and unresolved recollection conflict.
- No app/lib/SQL/auth/RLS/Storage/dependency changes, hosted queries, uploads, live seed records, privileged shortcuts or Stage 4 implementation. No real people/company/contact records used.

Checks
- `npm run test:ask`: all 16 existing Stage 3 unit checks passed (no live provider calls).
- Offline fixture validator passed: 15 source digests/locators/cross-references, fictional contacts, 18 question references/as-of dates, budget/schedule arithmetic and intentional conflict/gap assertions.
- No browser, live tenant-isolation, PDF/OCR or image-understanding tests performed. Markdown sources and captions are not PDF/image fixtures; no runtime change warrants re-running a production build for this pass.

Next
- User review of architecture and initial source package/answer key; commit/push only with explicit authorization.
- Separately authorize Stage 4 implementation and define text/PDF/drawing/image coverage; retain ground truth outside retrieval.
- Resolve Class C permission/transfer/revocation, entity resolution, conflict review and retention design before implementing those capabilities.

Blocked
- None for this documentation/text benchmark. No actual photo binaries, scaled plan sheets or PDF renditions supplied; exact concealed routing, missing closeout records and replacement warranty remain intentional unknowns.

Ask SITEPM Stage 4A — Friday, Sep 25, 2026

Status: ACCEPTED — derived evidence foundations only. Hosted `sql/week7_document_intelligence.sql` applied. Stage 3 Ask unchanged. Stages 4B–4F not started. Document contents are not searchable. No PDF intelligence. No Living Property Record implementation.

Done
- Additive `sql/week7_document_intelligence.sql`: `document_extractions` and `document_chunks` bound to a ready `documents` parent; company/project aligned from the parent; `source_sha256` must match the parent hash; provenance columns locked on update; FTS `search_vector` + GIN index as a foundation only
- Authenticated grants are SELECT only. No INSERT/UPDATE/DELETE for anon/authenticated. `replace_document_extraction()` exists as a refused 4B write hook with EXECUTE revoked from API roles
- Types in `lib/document-intelligence-types.ts` (not wired into Ask)
- Static schema contract test `npm run test:stage4a`; live JWT RLS: A/B SELECT isolation, Project A filter, authenticated INSERT/UPDATE/DELETE denied, write RPC not executable
- Hosted SQL Editor apply succeeded; live `ask-stage4a-rls.mjs` passed (no derived fixture rows yet)

Next
- Stage 4B extraction/chunking only when separately authorized

Blocked
- None for Stage 4A. App Ask paths do not read these tables yet.

Ask SITEPM Stage 4B — Friday, Sep 25, 2026

Status: MARKDOWN EXTRACTION + SECTION CHUNKING ONLY — ready for review; not committed. Ask/search unchanged. 4C–4F not started. Not PDF/OCR/photo/Living Property Record.

Done
- `lib/document-extract.ts`: SHA-256 of exact source bytes, ready-parent + hash binding, heading-based chunks (`## locator —`), caption vs section locator types, oversized split with part_index, no summarization/supersession
- `lib/rp001-corpus.ts`: loads only `docs/reference-projects/001/sources/*.md` (exactly 15); evaluator README/ground-truth/register/validate rejected
- Additive `sql/week8_document_extraction_write.sql`: `replace_ready_document_extraction(...)` binds tenant/hash from the parent `documents` row; EXECUTE revoked from anon/authenticated; Stage 4A no-arg refused hook unchanged
- Tests: `npm run test:stage4b`

Next
- Apply Week 8 SQL in the hosted SITEPM SQL Editor when authorized (do not guess CLI linkage)
- Stage 4C retrieval only when separately authorized

Blocked
- Hosted writer function is not live until Week 8 SQL is applied. Authenticated clients still cannot INSERT derived rows.

Ask SITEPM Stage 4B hosted acceptance — Friday, Sep 25, 2026

Status: WEEK 8 APPLIED — schema/security verified with JWT + anon key only. Canonical owner-only writer not exercised (no table-owner session used). Ask/search unchanged. 4C–4F not started.

Done
- Hosted `sql/week8_document_extraction_write.sql` applied in SQL Editor; `document_chunks.content_kind` is selectable
- Authenticated clients still cannot INSERT/UPDATE/DELETE derived rows
- Authenticated clients cannot execute `replace_document_extraction()` or `replace_ready_document_extraction(...)`; writer body did not run; extraction row count unchanged
- Live `scripts/ask-stage4b-rls.mjs` plus `test:stage4b`, `test:stage4a`, `test:ask`, Stage 4A RLS, `tsc`, lint, `git diff --check` all passed

Next
- Stage 4C retrieval only when separately authorized
- Commit/push Stage 4B only with explicit authorization

Blocked
- Owner-only `replace_ready_document_extraction` success path was not run: this environment has no safe table-owner/postgres session, and EXECUTE was not granted to authenticated to force a test
