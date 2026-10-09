# Sprint 3 receipt integrity investigation — 2026-10-09

## Finding and root cause

**Confirmed own-company data-integrity defect, fixed and verified in isolation.** Baseline: PR #3 44e5bda04049736e567826b3793ba81025fe6763. No production connection, credential change, migration, merge or deployment occurred.

The original field_report_saves table grants authenticated INSERT. RLS checks actor/company and report/project membership but does not attest report payload persistence or revision. save_field_report checks matching receipt payload before report validation or mutation. An authenticated company member can therefore fabricate a matching receipt for an existing report and receive replayed success for work never saved. This is not evidence of Company B reading Company A.

The isolated reproducer registered synthetic company A/B users, saved a report at revision 1, inserted an own-company receipt with a different work description and revision 77, then called the real Supabase RPC. **Before:** receipt insert succeeded, RPC returned replayed=true/revision=77, independent report read still showed original text/revision=1. `--expect-vulnerable` asserts this exact before state; it is diagnostic mode only.

## Fix

Follow-up migration `20261009214540_field_report_receipt_integrity.sql` preserves the original migration and all reports, crews, photos, tasks and receipts. It revokes client/API receipt DML, including residual column grants, and drops the obsolete INSERT policy. Authenticated users retain actor/company-scoped receipt SELECT.

The existing save RPC becomes the sole supported transactional receipt writer, owned by dedicated sitepm_field_writer. RLS remains enabled and actor/company/project validation remains inside the RPC and writer policies. The function signature, return shape, validation, report locking, request-key locking, related-write ordering and application calls are unchanged. Only successful completion of report/crew/follow-up writes inserts a trusted receipt in that same transaction.

A trusted column defaults false; new RPC inserts explicitly set true. Existing client-writable receipts are preserved but rejected for replay because their provenance cannot be established. Do not infer trust from matching current report content: historical edits/crews/tasks can differ legitimately. Operators must inspect any pre-fix uncertain submission and its report before starting a new key; blindly starting a new create risks duplicates. New committed receipts preserve exact and late retries even after newer report edits; changed request payloads still reject. No automatic deletion/backfill-to-trusted or resubmission occurs.

## Security and privilege review

SECURITY DEFINER is necessary here: revoking receipt INSERT while keeping SECURITY INVOKER would break authorized atomic saves. The owner is **not postgres**: NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS. It owns no tables/schema, has no API/client members and no persistent schema CREATE. It receives only report create/update/read concurrency fields, crew replacement, follow-up task INSERT, receipt SELECT/INSERT and required project/profile/identity reads. No receipt UPDATE/DELETE, report DELETE, unrelated document mutation or service credential is introduced. Existing authenticated report/crew/task privileges remain intact for compatibility; legacy direct saves remain nontransactional and crew-only writes do not advance the parent revision, as already documented.

RPC search_path is empty, row_security=on, SQL objects are qualified, tenant/actor come from established context rather than client parameters. The private argumentless postgres-owned identity bridge delegates only auth.uid(), needed because Supabase managed Auth schema grants cannot be delegated to the writer. Its private schema/body/EXECUTE ACL is checked; public/anon/authenticated/service_role cannot access it. Temporary public-schema CREATE for function ownership transfer is revoked before COMMIT. The migration refuses name collisions by normal CREATE failures; investigate drift rather than bypassing them.

## Isolated evidence

Guarded retained loopback stack: sitepm-documents-verified-replay (55461/55462). Fresh stack: sitepm-field-receipt-replay (55471/55472), using Supabase CLI 2.120.0, existing Docker bridge and synthetic credentials. Existing volumes preserved. A separately created Sprint 6 compatibility worktree contains only a test overlay of the fix; original Sprint 4–6 branches/uncommitted documentation were not changed.

- **Before reproducer:** confirmed false success as described above.
- **After reproducer/acceptance:** passed own-company REST receipt insertion, trusted-marker spoof, UPDATE/DELETE denial and direct authenticated SQL INSERT denial. RPC then genuinely persists the previously forged work at the actual next revision, returning replayed=false.
- **Retry/rollback:** exact, concurrent, late and discarded-response retries pass. An explicit pre-COMMIT interruption after RPC work rolls back both report and receipt; same key subsequently succeeds. Existing forged/untrusted receipt rejects without reporting success.
- **Isolation/ACL:** Company B cannot read A receipts or mutate A report/project, anonymous save denied; table and column DML revocations, private schema/helper denial, actual owner attributes/no table ownership/no client membership/no persistent CREATE and no unrelated document INSERT all pass.
- **Field acceptance:** report+crews+follow-up creation/edit, invalid writes, related-write rollback, corrected retry, competing editors (one success/one 40001), photos/tasks preserved, legacy direct report/crew paths and handoff to RPC pass.
- **Clean replay:** canonical local baseline → original Sprint 3 → receipt follow-up, then field acceptance; both Sprint 4 migrations → Sprint 5 migration with populated ready/pending/failed legacy adoption. All passed. This staged order is deliberate; follow-up's later timestamp does not replace the explicit release allowlist.
- **Full DB/Storage compatibility:** document-acceptance-local.mjs exited 0 after the fix, including real immutable Storage bytes, PDF extraction/FTS, TUS resume, quota/registration/verification/concurrency/reference/isolation checks, Sprint 3 acceptance and Sprint 4 acceptance/all four hardened-defect assertions. Final receipt-security test passed separately on the fresh fully migrated stack.
- **Regression:** document, scheduling, field reliability, operations, core-job, job-desk, Ask and lexical suites passed on the Sprint 6 compatibility tree; Sprint 3 relevant regression suites also passed.
- **Quality:** Sprint 3 and Sprint 6 compatibility TypeScript and supported webpack production builds passed. Next route type generation was required in the fresh worktree; initial missing LayoutProps was a generated-types prerequisite, resolved without source changes. Lint has zero errors and one existing unused tokenize warning. Existing middleware deprecation/Edge crypto warnings were not introduced by this change. Final diff whitespace check passed.

New dedicated gate: `SITEPM_ISOLATED_ENV=<ignored-local-env> npm run test:field-receipts:db`. Helper rejects hosted endpoints, unknown port pairs and non-test DB/admin identities before connecting. Run alongside field-reliability database acceptance. No fresh browser interaction or physical-device test was performed for this SQL-only fix; prior Sprint 3–6 browser reports remain baseline evidence, not a new execution claim. The discarded-response test is an intentional response discard, not a physical network disconnection.

## Release manifest and revised readiness

**Receipt blocker resolved in isolated acceptance; production release remains NO-GO pending remaining gates and review of this new SHA.**

Sprint 3 release must apply original `20261008054310_field_report_atomic_save.sql` **then** `20261009214540_field_report_receipt_integrity.sql` under one continuous verified report-write pause, before reopening the application or advancing Sprint 4. Do not expose the original client-writable receipt boundary between stages. Follow-up SHA256: 9d7247ec6d73399e3881b3657b45a9ea80186b449913dcc62dec67acc1981eb2.

Only the explicit reviewed migrations may run; no blanket push/reset/local-baseline replay. Original migration requires connection-level 5s lock/60s statement timeouts; follow-up has them inline and wraps BEGIN/COMMIT. Postflight checks must now expect bounded field writer SECURITY DEFINER, trusted receipts, private identity bridge and revoked API receipt DML, replacing the former invoker-only expectation. Verify role/table/column ACLs, RLS and RPC schema cache before deployment. Preserve original compatibility limits and refresh/drain old tabs.

For future environments already containing Sprint 4/5, applying this follow-up after those migrations was also verified. Pending ordered production release should still apply it within Sprint 3's cutover. Migration-history tooling must deliberately reconcile the explicit staged order rather than replaying everything by filename.

Update PR #3 only after final checks pass. PRs #4/#5/#6 retain their existing branch work; later retarget/reconcile them against the newly reviewed main ancestry and rerun their merge-candidate gates. Do not rewrite or merge their branches automatically. The new helper uses a distinct name to avoid replacing their independently evolved isolation helper.

Remaining release prerequisites: verified encrypted DB **and Storage** backup with actual successful protected isolated restore, correct production project/schema/ACL/data-adoption preflight, verified write-pause boundary, Railway configuration/build/autodeploy/rollback checks, draft Sprint 5/6 signoff and explicit execution authorization. No production recovery or hosted acceptance is claimed. Keep incompatible scheduling/document writes blocked on older-app rollback; never regrant vulnerable receipt writes, drop history or destructively restore automatically. A failed migration transaction requires catalog verification before retry; preserve all pre-existing receipts/evidence.
