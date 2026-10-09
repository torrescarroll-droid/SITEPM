# Sprint 4 scheduling integrity hardening

## Write boundary and privilege review

The original save RPC was transactional but not exclusive: authenticated table grants allowed callers to bypass composite revisions, receipt provenance, graph locks and eligibility checks. The follow-up migration `20261008201434_scheduling_integrity_boundary.sql` closes those grants for activities, resources, assignments, dependencies and receipts. Authenticated users retain company-scoped reads and EXECUTE on the existing bounded save RPC. Scheduling client code does not use service-role credentials.

The RPC now uses SECURITY DEFINER **only because** revoking direct DML would also remove the underlying permissions from a SECURITY INVOKER RPC. Its owner is `sitepm_schedule_writer`, a dedicated NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS role. It owns no scheduling tables or schemas. No client/API role is a member. Only the migration administrator receives membership to transfer function ownership. Public-schema CREATE is granted solely within the migration transaction for ownership transfer, then revoked. The role's function uses empty `search_path`, `row_security=on`, fully qualified application objects, no dynamic SQL, and derives actor/company from the established authenticated context. Anonymous execution is revoked. Neither company ID nor receipt result is accepted from the client.

| Object | Writer privileges | RLS scope |
| --- | --- | --- |
| projects | SELECT id/company_id | Authenticated actor's company |
| tasks | SELECT id/project_id/company_id | Actor's company; task/job association also validated by trigger |
| profiles | SELECT id/auth_user_id | Actor's own profile only |
| activities/resources | SELECT, INSERT, UPDATE | Actor's company; activity project must also belong to company |
| assignments/dependencies | SELECT, INSERT, DELETE | Actor's company; composite FKs and project/graph triggers remain enforced |
| receipts | SELECT, INSERT | Actor **and** company |
| public/private scheduling schemas | USAGE | No Auth schema grant, persistent CREATE or schema ownership |
| private actor_id/current_company_id | EXECUTE | Existing authenticated identity semantics; no user-metadata authorization |
| field reports, photos, history | No new writer grants | Existing behavior unchanged; trigger-only audit code records history |

The managed Auth schema cannot be delegated by Supabase's postgres administrator. An argumentless `sitepm_schedule_internal.actor_id()` helper therefore delegates only `SELECT auth.uid()` under that existing administrator. It has an empty search path, no table access or inputs, resides in a non-exposed private schema, and is executable only by the writer (and administrators). Neither authenticated nor anonymous users have private-schema USAGE or helper EXECUTE. This second narrow definer is necessary to preserve the existing identity helper without granting Auth-admin membership or duplicating JWT parsing. The existing narrow trigger-only audit functions remain revoked from direct execution. The existing dependency alignment trigger remains a trigger-only definer; its search path is tightened to empty and graph locking is added before cycle validation. This does not make the save RPC a postgres-owned RLS bypass. Tests inspect the actual function owner, role attributes, memberships, ACLs and RLS, and exercise cross-company calls as that owner.

Direct authenticated SQL and Data API scheduling DML are intentionally unsupported and rejected, including legacy activity/resource writes. Authorized application saves retain the same public RPC signature. Administrators can always alter a database; that power is outside the application trust boundary. Tests use administrator-only SET ROLE to exercise the lower-level guards independently; it is not a new credential or supported client access mechanism.

## Integrity rules

- Every assignment INSERT/DELETE/UPDATE and dependency INSERT/DELETE advances the parent revision through an invoker trigger. The activity guard still controls revision values. A composite save may advance revision more than once; revision is an opaque positive concurrency token, not a save counter. The RPC checks the opening token before mutation and returns the final token after all relationship triggers finish. Failed transactions roll back rows, revision, audit and receipt together.
- Only the trusted transactional save operation can create application receipts. Exact retries preserve their request/payload identity, return the recorded final token, and do not overwrite later edits. Pre-hardening receipts remain stored with `trusted=false` and cause stale/reconciliation feedback rather than false success. This matters for upgraded isolated environments; Sprint 4 has never been deployed to production.
- The RPC serializes company mutations. Dependency guards also take the same transaction advisory lock before validating the graph, protecting permitted administrative relationship writes. Two- and three-activity concurrent cycles must reject at least one transaction. READ COMMITTED is required; repeatable-read stale snapshots are rejected explicitly. This is the standard Data API transaction isolation. No application-only cycle check is trusted.
- New assignments require an active same-company resource, checked by an invoker database trigger with a resource row lock. Deactivation retains existing plans and history. Unrelated activity edits can preserve an unchanged inactive assignment. Adding/reassigning it or changing its expected worker count is rejected; removing it is allowed. Directory status is not an attendance signal.

## Reproducible clean local replay

Existing local databases and fixtures must not be reset. The generated canonical baseline is for a new local stack only; never apply `19700101000000_local_baseline.sql` to production.

```sh
npm run db:isolated:prepare
node scripts/prepare-scheduling-replay.mjs /private/tmp/sitepm-scheduling-integrity-final
# Creates a separate bridge, not an internal Docker network (published ports need host access).
docker network create sitepm-scheduling-hardening-bridge
npx --yes supabase@2.120.0 start --workdir /private/tmp/sitepm-scheduling-integrity-final --network-id sitepm-scheduling-hardening-bridge --exclude realtime,storage-api,imgproxy,studio,postgres-meta,edge-runtime,logflare,vector,supavisor
# Redirect secrets to this ignored local file; do not print or publish them.
umask 077
npx --yes supabase@2.120.0 status --workdir /private/tmp/sitepm-scheduling-integrity-final -o env > .env.isolated-hardening.local
SITEPM_ISOLATED_ENV=.env.isolated-hardening.local node scripts/apply-isolated-scheduling.mjs
SITEPM_ISOLATED_ENV=.env.isolated-hardening.local npm run test:scheduling:db
SITEPM_ISOLATED_ENV=.env.isolated-hardening.local npm run test:field-reliability:db
SITEPM_ISOLATED_ENV=.env.isolated-hardening.local node scripts/setup-isolated-browser.mjs
SITEPM_ISOLATED_ENV=.env.isolated-hardening.local node scripts/start-isolated-app.mjs --build
SITEPM_ISOLATED_ENV=.env.isolated-hardening.local node scripts/start-isolated-app.mjs --production
```

`prepare-scheduling-replay.mjs` refuses an existing destination. To resume the prepared environment, use its existing configuration rather than preparing/resetting it again. The verified new stack uses API 55441 / DB 55442 and project ID `sitepm-scheduling-integrity-final`; the prior stack remains API 55431 / DB 55432. Shared test environment validation permits only those exact loopback port pairs. Browser fixtures for the new stack use a separate ignored metadata file. Optional Storage/blob services remain excluded; no production credentials or fictional production records are involved.

An internal Docker network prevented published database port access; the separate bridge fixes that. Earlier CLI 2.81.3/Auth/REST test setup also exposed the managed Auth schema's privilege limitations and ambiguous concurrent REST results in both scheduling and unchanged Sprint 3 tests. The final setup uses current CLI 2.120.0/REST, initializes managed Auth first, then installs the scheduling migrations. The writer uses the private identity bridge rather than attempting an ungrantable Auth schema privilege or inheriting broad roles. Prior test volumes are retained. Only the final completed replay/acceptance establishes readiness; earlier setup/test failures are not counted as passes.

## Compatibility and release control

Sprint 3's branch and release remain unchanged. Its field-report RPC, migrations, RLS and product code are untouched; its database test launcher only gains the same guarded choice of local environment. Sprint 4 stays stacked on `44e5bda` and releases after Sprint 3.

The hardening migration deliberately removes legacy direct scheduling write compatibility. A future authorized release must block schedule writes at the operational gateway/maintenance boundary, verify that block, apply both reviewed Sprint 4 migrations in order, verify objects/ownership/RLS/ACLs, deploy the matching application, then verify confirmed saves before lifting the block. Application-first deployment is unsupported. No migration is applied to production by this sprint.

Rollback is not dropping tables, erasing history, granting old direct-write access, or automatically restoring production data. If the application must roll back, keep schedule writes blocked; the old Sprint 3 UI cannot safely write through the hardened schema. Preserve data and use an approved forward fix or separately reviewed recovery. Production backup/isolated restore verification, current-schema preflight, correct-project confirmation, Sprint 3 ordered release and explicit release authorization remain prerequisites.

## Acceptance record

Verdict: **READY WITH CONDITIONS for engineering review**, after all four defects pass isolated database acceptance. This is not production release approval.

| Gate | Result / evidence |
| --- | --- |
| Original four-defect reproducer, before | All four vulnerabilities reproduced; exit 1 against the predecessor schema |
| Hardened four-defect acceptance, after | All four PASS; included in `npm run test:scheduling:db` so a regression fails the regular gate |
| Clean replay | New CLI 2.120.0/PostgreSQL 17 local stack: canonical baseline + Sprint 3, managed Auth initialization, original scheduling migration, integrity migration; both scheduling migrations committed successfully |
| Scheduling database acceptance | PASS: assignments, dates/times/DST, project/task ownership, A/B reads/writes, rollback/audit, exact/concurrent retries, stale edits, cancellation, inactive resources and graph validation |
| Concurrency and direct SQL | PASS: direct authenticated API/SQL denied; administrator-only writer exercise bumps revisions; concurrent two/three-node RPC cycles and three-node direct writer cycle prevented; repeatable-read writes rejected |
| Receipt integrity | PASS: API/SQL forgery denied, pre-commit rollback leaves no receipt, exact retry commits once, concurrent repeats return same result, untrusted legacy receipts reject |
| Writer security | PASS: actual catalog ACL/owner/search_path/role checks, RLS under actual writer identity, no client membership, no schema CREATE, no unrelated report write grants, private identity bridge inaccessible to clients |
| Supabase security advisors | PASS: isolated local security advisors reported no issues |
| Sprint 3 live database acceptance | PASS: atomic report/crew/follow-up persistence, rollback, duplicates, competing editors, A/B isolation, legacy report compatibility and transition to RPC |
| Unit/regression suites | PASS: scheduling, field reliability, operational lookahead, core-job schema/logic, job desk, Ask Stage 3 and lexical |
| TypeScript / lint | PASS TypeScript; lint zero errors, one pre-existing unused `tokenize` warning in `lib/ask-stage4e-fts-experiment1.ts:197` |
| Supported production build | PASS webpack production build; existing middleware-to-proxy deprecation remains |

Browser acceptance used the isolated supported production build and synthetic Company A/B accounts. Desktop resource creation covered employee and subcontractor company; activity creation assigned both with expected counts 1 and 3. Pending controls disabled, then persistence confirmation appeared. Rescheduling and status changes saved. Invalid timezone returned “Nothing was saved” and retained inputs; reopening after reload recovered the exact draft. A concurrent synthetic database edit caused stale-save rejection, preserved changed count inputs, and reloading the latest record restored the committed count. Cancellation required confirmation and retained history/assignments while hiding the cancelled activity. Project schedule and 14-day lookahead displayed the same saved work. Company B saw an empty company calendar/resource directory, only its own job option, and a 404 for Company A’s project schedule. Desktop month and next-period navigation also passed after the final build.

Mobile browser emulation at 390×844 exercised week, compact month, month-to-day navigation, details/edit, cancellation and interrupted-save recovery. Document width equaled viewport width (390). A synthetic eight-second database delay plus reload produced an unconfirmed locked draft and “Retry and confirm save,” never success. Retry while the fault remained stayed unconfirmed. After removing the fault, the same recovered request confirmed success; database inspection found exactly one activity and one receipt for that creation. The fault trigger was removed. Screenshots are local review artifacts outside Git.

Physical devices, real jobsite networking, offline synchronization, production schema preflight, production backup/restore, hosted release/rollback and large-company load tests were not performed. Browser tests are recorded interaction acceptance, not a CI browser suite. Company-level serialization is conservative and can cause contention/timeouts under load; the UI must continue treating unconfirmed writes as retryable. Existing pagination/large-portfolio and history-window limitations remain in the engineering review. Future Gantt, explicit baseline/actual schedules, labor time entries/cost codes and metrics remain additive work; expected assignments and audit times are never actual attendance or labor.
