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
