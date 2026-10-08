# Sprint 3 production migration and rollback plan

Status: review plan only. Production migration, merge, deployment, and production record writes require explicit release authorization. None were performed during readiness verification.

## Read-only production review

On 2026-10-07 PDT, inspected PostgreSQL catalogs in a read-only transaction on the existing SITEPM Supabase project. PostgreSQL 17.6; the required `field_logs`, `field_log_crews`, `tasks`, `profiles`, and `projects` columns, foreign keys, grants, alignment triggers and tenant policies match this migration's prerequisites. No business records were retrieved or changed.

- RLS enabled on all five tables. Authenticated report/crew/task policies enforce company and project membership.
- `current_company_id()` resolves the authenticated profile; company alignment and same-job task/report triggers are present.
- Authenticated report SELECT/INSERT/UPDATE, crew CRUD and task CRUD permissions are already available to the SECURITY INVOKER RPC.
- `field_logs.revision`, `field_report_saves`, and `save_field_report` are absent. No new-object collision was found.
- Repeat this catalog-only preflight immediately before release to detect intervening schema drift. Stop if prerequisites or policies differ.

## Compatibility and release order

Migration `supabase/migrations/20261008054310_field_report_atomic_save.sql` is additive. It adds a defaulted revision column/update trigger, a receipt table with actor/company RLS, and an authenticated SECURITY INVOKER RPC. Existing columns, report IDs, photo/task references, table grants and old policies remain intact.

The `12a0615` main application uses direct report insert/update and crew replacement. These exact database paths were exercised against the migrated isolated database: omitted revision defaults to 1, old report updates advance revision, crew delete/insert still works, and the resulting report can subsequently be edited through the new RPC. The new application requires the RPC and fails closed when it is unavailable. Therefore apply the migration **before** deploying this application.

Legacy saves remain nontransactional until the new application is deployed. Old crew-only writes do not independently advance the report revision. During cutover, briefly pause field report entry and drain in-flight requests; have users reload old report tabs after deployment. Do not promise transactional protection for an old client still executing the previous application version.

## Authorized release procedure

1. Confirm the reviewed PR SHA, deployed application SHA, Supabase project identity, backup/PITR availability and recovery owner. Record a current recoverable backup point using the existing platform process; never copy production credentials into repository files or logs.
2. Re-run the read-only prerequisite checks above. Review the exact migration diff. Do not run the generated `19700101000000_local_baseline.sql` against production, and do not use a reset or a blanket push of all local migrations.
3. Pause report entry and drain legacy saves. Use an approved database connection/session with `lock_timeout = '5s'` and `statement_timeout = '60s'` to run only `20261008054310_field_report_atomic_save.sql`. The file wraps its DDL in BEGIN/COMMIT. A lock/statement timeout or any error requires rollback and investigation; do not remove the timeout just to force completion. Adding the column/trigger takes a table lock, so choose a quiet release window.
4. Verify committed objects from catalogs: positive non-null defaulted revision, update trigger, receipt primary/FKs, RLS policies, authenticated-only RPC execution, fixed search paths and SECURITY INVOKER. Refresh PostgREST's schema cache through the approved Supabase mechanism if the RPC is not yet visible. Record migration history using the project's approved migration process, without replaying unrelated historical SQL.
5. Deploy the reviewed application only after database verification and separate explicit deployment authorization. Reopen report entry after read-only health/auth/page checks and refreshed client tabs. Isolated acceptance already proves write behavior; do not write production test records without separate authorization.
6. Observe application errors, RPC permission/validation failures, lock timeouts and duplicate-save reports. Stop rollout if tenant isolation, transaction integrity or confirmation behavior differs from acceptance.

## Rollback and recovery

- **Migration fails before COMMIT:** roll back the transaction. The previous schema/application remains the expected state. Confirm catalog state before retrying; do not assume a timed-out connection rolled back until verified.
- **Migration succeeds, application not deployed:** retain the additive schema and keep the existing app running. Compatibility acceptance passed. Resolve rollout issues without deleting receipts or revisions.
- **Application regression after deployment:** pause report entry/drain requests, roll the application back to the previously verified deployed SHA through the normal release process, and retain the additive database migration. Existing report/task/photo data and receipts remain preserved. Legacy application reliability limitations return until a fixed release.
- **Database integrity/security concern:** suspend affected writes and escalate for a separately reviewed forward repair. Preserve receipts and evidence. Do not automatically drop the new table/column, restore an older database over new records, or reverse report revisions. Any schema downgrade or PITR restore is a separate destructive operation requiring authorization and a data reconciliation plan.

## Remaining operating limits

Draft recovery is same-tab SessionStorage, not offline background synchronization or cross-device recovery. Photos upload separately after confirmed report persistence. Local Storage blob acceptance was unavailable; report/crew/task writes and photo metadata relationships were tested. Receipts retain report payloads indefinitely under actor/company RLS; a future retention policy must preserve safe retry semantics. Responsive desktop-browser acceptance does not substitute for testing physical phones and intermittent cellular networks during beta use.
