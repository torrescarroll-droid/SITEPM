# Sprint 5 — Documents & Project Intelligence

Implementation branch: `codex/documents-project-intelligence`, based on Sprint 4 `870f9a269934e03bc3f7abdc6775bc679b72b6ee`. This document records development, not production release. Sprint 3 and Sprint 4 remain separate pending releases. No production connection, migration, business-record write, merge or deployment was performed.

## Contractor workflow

Open **Plans & Docs** from company navigation (Docs in the mobile header) or a job’s Documents tab. Upload PDF, JPG/JPEG, PNG, DOCX, XLSX or PPTX up to 20 MiB. Give it a title, category, optional collection/trade and issue label/date. Flat collections organize a job without imposing a folder tree.

The uploader shows preparation, transport progress and verification. It confirms success only after the server downloads the stored object, validates its format/size/MIME/hash and the trusted database operation commits. The file is then an available candidate. Review its version and explicitly **Make version current**; the previous current issue remains usable until that promotion succeeds. Promotion is team selection, not approval of construction instructions.

Add replacements inside the same document group. Original bytes, paths, canonical IDs, hashes, issue labels and versions are retained. Use Download version for an exact source. Change organization without changing source bytes. Archive hides the group from ordinary lists/Ask and denies new file access; restore makes retained files available again. There is no routine hard deletion.

Upload interruptions retain an actor/company-scoped tab draft, request identity and opaque TUS checkpoint. Reselect the same file after reload; its checksum must match. Retry reconciles a possibly committed upload before transferring again. A trusted receipt recovers lost confirmation even during a later Storage outage. Discarding a local draft does not delete pending records/bytes. Logout/account switch clears scoped drafts; browser file bytes are never promised as offline storage.

Search metadata across the company or one job, including title, category, collection, trade, filename and issue label. Select a job and enable PDF text search for current indexed digital PDFs. Text excerpts show the exact file ID, page locator and source hash. Existing Ask retrieval/citations reuse current, ready, unarchived evidence. PDF text is source material; model responses remain interpretations governed by the existing evidence/citation defenses. Basic uploading/search/download works without AI or the extractor.

Pin a ready version to a task, schedule activity or daily report in the same job. These references appear in job task/schedule/report screens and survive current-version promotion. Archived and different-current warnings prevent silent source substitution. References never complete tasks, reschedule activities or create actual attendance. Existing field photos are not duplicated.

## Architecture and integrity

Migration: `20261009010546_document_management.sql`, after canonical baseline, Sprint 3, and **both** Sprint 4 migrations.

| Entity | Responsibility |
| --- | --- |
| Existing documents/Storage | Immutable physical identity, filename/type, bytes/hash, uploader/date and readiness. Canonical IDs/paths/extraction FKs are preserved. |
| document_families | Company/project logical identity, organization, archive, explicit current pointer, opaque revision and timestamps. |
| document_versions | One membership per canonical file; monotonic family/version, issue metadata, trusted verified_at, processing state/lease. |
| document_upload_attempts | Actor-bound exact-payload request receipt; verification may only be recorded by the trusted operation. |
| document_events | Append-only upload/promotion/metadata/archive/link history, actor/time, before/after organization and typed work-reference snapshots. |
| document_links | Exact-version task/activity/report references with composite company/project FKs, uniqueness and family membership. |
| Existing extractions/chunks | Existing bounded PDF parser, restricted extraction writer, source SHA/page provenance and PostgreSQL FTS. No new corpus/vector/model dependency. |

`begin_document_upload` serializes request/company/family registration and allocates versions transactionally. Repeated identical actor requests return the original identity; changed payload rejects. Failed relational writes roll back family/version/attempt/history together. Database and Storage cannot form one distributed transaction: unverified candidates remain unpublished and recoverable instead of pretending atomic blob persistence.

`manage_project_document` locks the family and compares its expected revision before promotion, metadata, archive/restore or link changes. Exactly one stale competing edit can commit. The current pointer must belong to the exact family and a ready canonical source. Typed FKs also prevent later relocation of a referenced task/activity/report into another job. Remove a reference first if that operational record must be deleted/moved; there is no silent cascading evidence loss.

Legacy documents are deterministically adopted as one family/version each, keeping IDs, paths, hashes, status and Storage bytes. Only legacy ready rows become current. No guessed filename grouping, invented past promotion history or invented byte-verification receipt. The UI explicitly labels legacy sources lacking Sprint 5 attestation. Pending/failed legacy sources are retained and not made ready. A populated replay caught deferred FK events blocking RLS alteration; the migration now flushes that membership constraint before ALTER operations. Migration lock timeout is 5 seconds and statement timeout 60 seconds; failure rolls back rather than forcing a lock.

## Security and privileges

- Reads inherit the existing company/project authorization model. This is not a new private-project/member or external-participant ACL system. Same-company authenticated members who can access a job can access its document records. Company B cannot read or mutate Company A records or files.
- Client INSERT/UPDATE/DELETE on canonical/new document records is revoked, including the old status column grant and dormant legacy write policies. Unused nontransactional uploader was removed. Scheduling/field-report mutation architecture is unchanged.
- Dedicated `sitepm_document_writer`: NOLOGIN, NOINHERIT, NOBYPASSRLS, owns no tables/schema; narrowly scoped grants/policies. Five mutation functions use this owner, empty search_path and row_security=on. No authenticated/anon/service-role membership. Temporary schema CREATE for owner transfer is revoked in the same transaction.
- `sitepm_document_verifier` has no table access, no RLS bypass and only EXECUTE on byte verification and processing operations. A separately provisioned server-only login uses transaction-local authenticated subject; browser/PostgREST roles cannot attest bytes or forge receipts. `SITEPM_DOCUMENT_DATABASE_URL` is server-only, TLS required remotely, pool limited to two connections. Local credentials are synthetic and ignored.
- Private identity bridge only returns auth.uid(); fixed empty search_path and no API-role access. Storage helper only tests registered company/path/state/archive access; it does not mint URLs or expose file contents. It is postgres-owned because it must evaluate pending ownership independent of API row visibility; argument/owner/ACL/search_path are reviewed. Existing privileged extractor remains a separately trusted backend capability, not a general query endpoint. Its scope is not expanded.
- Storage bucket remains private and 20 MiB bounded. API uploads require registered immutable paths and the pending creator. No object update/upsert/delete policy. Downloads require authorized ready/unarchived source and use 60-second signed attachment URLs; issuing route is private/no-store/no-referrer. Previously issued links remain usable until expiration; archive is not instant URL revocation.
- Current/unarchived filtering is in chunk SELECT RLS **before ranking**, including direct chunk reads. Historical source files remain downloadable when unarchived, but historical-content search/as-of timelines are not implemented.

## Limits and controls

Transport control requests have 15-second deadlines; 6 MiB data chunks allow 120 seconds for slower connections and retain resumable checkpoints. These are bounded recovery controls, not real-cellular acceptance.

Per-file maximum: **20 MiB**. Per-user new registration limit: **50/hour**. Company pilot retained-capacity budget: **2 GiB**, including archived/legacy/pending records. Every unverified file reserves the full 20 MiB bucket maximum; only trusted byte verification releases unused reservation. This prevents small declared sizes from understating potential stored bytes. Exact committed request retries remain valid at the limit. Legacy sources without a receipt retain the conservative full reservation.

This is registered-file capacity accounting, not a guaranteed provider billing ceiling: partial TUS sessions, provider temporary objects, prior orphaned blobs and managed cleanup are outside that logical sum. Do not bypass failed uploads by repeated new requests. Operational storage reconciliation, monitoring/alerts and reviewed abandoned-attempt cleanup remain release/pilot work; this sprint does not delete files automatically.

Text indexing is explicit, independent of file persistence: two recent processing leases/company, 20 attempts/user/hour, bounded existing parser child process. Unsupported scans/encrypted PDFs remain saved; error/retry state is visible. Leases expire after two minutes; this is recovery control, not a durable background queue/offline service. A server interruption does not publish an unverified source.

Format hygiene checks PDF envelope, image signatures/dimensions and bounded Office ZIP structure/content types; rejects legacy/macro Office types, obvious VBA/ActiveX/embedded/external-link packages, encrypted ZIPs, traversal and extreme expansion. Office/images are download-only. Live browser upload/download acceptance for non-PDF formats remains part of the incomplete browser gate; format validation is covered by automated fixtures. This is **not antivirus, malware certification, OCR or full semantic validation**. No active document content runs in the application. Do not add a scanning vendor/raw-file third-party processor without approval.

## Acceptance record

All write tests target guarded loopback Supabase Auth/PostgreSQL/Storage stacks with synthetic fixtures. Scripts reject hosted/arbitrary endpoints. No production credentials were borrowed. Existing test volumes were preserved. Earlier exploratory failures are not passing evidence.

Verified acceptance coverage:

- Fresh canonical + Sprint 3 + both Sprint 4 + Sprint 5 migration, with populated ready/pending/failed legacy data and exact Storage byte preservation.
- Real Storage upload/download, immutable overwrite rejection, multi-chunk TUS transfer, HEAD checkpoint resume and complete SHA preservation.
- Atomic registration/rollback; exact/concurrent request replay; forged ready/receipt/direct mutations denied; wrong project/company/family and premature promotion rejected.
- Immutable replacement sequence, simultaneous version allocation, stale/concurrent promotion, all three typed work references, cross-job assignment/target-move rejection, archive/restore and anonymous/A/B isolation.
- Actual restricted owner/search_path/RLS/role membership and verifier table-denial checks.
- Real stored PDF parse/persist/FTS, page/hash provenance, processing lease/ACL; candidate/superseded/archived text excluded before ranking; Company B sees no chunks.
- Sprint 3 DB acceptance and Sprint 4 DB acceptance plus all four integrity reproducers passed with the document schema installed.
- Document byte/Office safety, resumable transport/recovery/deadline and actual server-action unit harnesses passed. Operational, scheduling, field reliability, core-job, job-desk, Ask Stage 3/lexical and PDF extraction/persistence regressions passed. Historical static PDF tests now follow the actual explicit-indexing call site/authorized lexical wrapper instead of the removed uploader.
- TypeScript and supported `next build --webpack` passed; lint passed with zero errors and one pre-existing unused-tokenize warning. Default middleware deprecation remains upstream/existing.
- Authenticated built-app HTTP document/detail/project/task/schedule routes rendered; Company B detail/file denied. Next.js streamed not-found may use HTTP 200 with a not-found marker; no document detail was disclosed. HTTP rendering is not browser save acceptance.

**Browser gate remains incomplete:** early local browser upload showed pending/failure/retry and a persisted PDF candidate/detail; 390×844 emulated layout was inspected. A native confirmation then stalled browser click/keyboard dispatch across tabs. Programmatic input/reloads/read snapshots still worked but did not establish successful interactions; dismiss/close recovery timed out. New document confirmations now use inline controls. Final built-app save/promotion/link/archive/recovery, complete mobile interactions, keyboard accessibility and browser tenant switching require a working runner. No physical-device or real jobsite-network testing is claimed. Leave the PR draft while this gate is incomplete.

Not yet verified: malware scanner integration (not implemented), physical devices, cloud/production schema/ACL preflight, production storage behavior/limits and restore, sustained multi-tenant load, 1,000-family/25,000-chunk latency budget, live AI response quality/provider availability. UI bounds: 50 families/page; latest 100 versions/events/links on detail; 200 records/type in work selectors. Large-history traversal/selector pagination is future work. No large-company scale claim.

## Reproducible local setup

Requires Docker and Supabase CLI 2.120.0 (used here), existing npm dependencies, and available loopback 55461/55462/3108. Do not reuse production URLs. CLI startup/status can print local credentials: redirect to an owner-only file and never paste full output.

1. `npm run db:isolated:prepare` generates ignored canonical baseline from repository SQL.
2. `node scripts/prepare-document-replay.mjs /private/tmp/sitepm-documents-new-replay` creates a **new** workspace; refuses existing directories and performs no reset.
3. Start that workspace using the CLI, keep Auth/Storage; optionally exclude realtime,imgproxy,studio,postgres-meta,edge-runtime,logflare,vector,supavisor. Use a dedicated Docker bridge if required by the local Docker installation. Preserve existing volumes. CLI normally applies copied canonical/Sprint 3 migrations. If application schema is empty, only then use the explicit `--bootstrap` guard in the next step.
4. `node scripts/capture-document-local.mjs /private/tmp/sitepm-documents-new-replay .env.isolated-document-replay.local` writes only local API/DB/anon settings, mode 0600. `SITEPM_SUPABASE_CLI` may specify the CLI executable.
5. With `SITEPM_ISOLATED_ENV=.env.isolated-document-replay.local`, run `node scripts/apply-document-local.mjs --legacy-fixture`, then `node scripts/configure-document-local.mjs`. The latter provisions random restricted **local** verifier/extractor logins and stores them in the ignored file. No production role reset.
6. Run `node scripts/document-acceptance-local.mjs`, `node scripts/document-limits-db.mjs` and `npm run test:documents`. DB suite writes ignored synthetic browser-account references. Never commit environment/runtime files or generated baseline.
7. `node scripts/start-isolated-app.mjs --build`, then `--production`, runs supported webpack build/app against this guarded local stack. `node scripts/document-app-http.mjs` checks authenticated route rendering while the app runs; use browser acceptance checklist below for interaction verification.
8. Relevant regression scripts, `next typegen`, `tsc --noEmit`, lint. Hosted historical scripts are deliberately excluded; never run them implicitly with a developer’s environment.

Browser checklist: new upload + verified feedback; interrupted TUS/reload/same-file retry; wrong-file rejection; replacement preserves current; explicit promotion; simultaneous stale edit; organization/search/PDF indexing; task/activity/report links and pinned-version warnings; archive/restore/download; logout/account switch clears drafts; Company B detail/download/list denial. Repeat mobile width 390 and narrow 320, and keyboard/touch-appropriate controls. Capture screenshots from the final built app, not fixtures/mockups.

## Production release and recovery plan — not executed

1. Release Sprint 3 first, then Sprint 4 with their own reviewed migrations/authorization. Reconcile/retarget stacked PRs without folding Sprint 5 into earlier releases.
2. Obtain explicit Sprint 5 release authorization. Verify the correct Supabase project/current schema/ACL and prior migration order read-only. Rehearse against a protected production-shaped copy. Audit legacy status/hash/path/MIME/size/Storage membership and existing object anomalies before adoption; legacy readiness is not a Sprint 5 verification certificate. Review grants/default ACLs and existing policies. Stop on unexpected schema/owner/data/locks.
3. Verify secure backup and successful isolated restoration of **both DB and Storage bytes**, with object manifest/checksums, retained versions/history, policies/roles/functions and recovery documentation. A pg_dump does not back up blobs or restore managed Auth/Storage service configuration/secrets. No destructive production restore/automatic credential reset.
4. Provision the narrow server verifier login from the approved role; keep credentials secret/server-only, TLS and minimal EXECUTE rights, no table access/RLS bypass. Verify extractor backend configuration separately. Deploy config only with approved release; missing verifier fails uploads closed and missing extractor leaves originals usable.
5. Briefly pause **document mutations/uploads** across old application clients through migration and matching app deployment; drain in-flight writes, reconcile pending sessions, keep originals available where safely possible. Apply only the reviewed Sprint 5 migration, with lock/statement timeouts. Verify data-preserving backfill, all objects/FKs/indexes/RLS, function owners/search_path/ACLs and no client DML grants. Stop on failure; never force a migration.
6. Deploy matching application only after migration verification. Old app reads mostly remain compatible, but its direct uploader is **intentionally incompatible** with revoked grants; a schema-only rollout is not sufficient. Do not reopen old upload paths.
7. Health checks must not create production business records. Check authorized pages, existing permitted source opens, expected API/ACLs and deployment health with approved access. Isolated acceptance supplies write evidence. Reopen document writes only after matching-app/config verification.
8. If application rollout fails, keep document writes paused; retained IDs/bytes/history permit read-only access and a reviewed forward fix. Do not drop new tables, delete versions, reset the database, revert security grants or destructively restore. DB transaction failure rolls back its schema/backfill automatically. A destructive recovery plan requires separate incident authorization and isolated rehearsal.

## Future intelligence and next work

Stable canonical/version IDs, hashes, issue metadata, current selection history, extraction identity/locators and typed work links enable additive revision comparison, RFI/submittal traceability, closeout/warranty records and reviewed schedule impact. They do not yet provide as-of reconstruction, OCR, drawing interpretation, automatic approvals, predictive forecasting or property transfer. Retained history provides a foundation, not proof that derived claims are verified construction facts.

Complete the browser gate and contractor pilot hardening next. Then add larger-history/selector navigation, storage reconciliation/monitoring, realistic performance measurement and schedule-to-field evidence workflows driven by contractor feedback. Gantt, critical-path, labor tracking/metrics and cost-code integration remain the separate scheduling roadmap.

## Final isolated verification — 2026-10-09

Fresh stack `sitepm-documents-verified-replay` (Supabase CLI 2.120.0, PostgreSQL 17, Storage 1.79.36) passed canonical/Sprint 3 initialization, both Sprint 4 migrations and the final Sprint 5 migration, including populated legacy adoption and exact blob preservation. Initial Storage health timeout was retried normally with volumes preserved; no health check was bypassed.

`document-acceptance-local.mjs` exited 0: legacy verification; document transaction/privilege/tenant/concurrent/reference tests; real PDF extraction/FTS; real multi-chunk TUS/HEAD resume; quota tests (50/hour, exact retry at limit, full reservation despite one-byte declarations, capacity rejection rollback); Sprint 3 write/compatibility tests; Sprint 4 write tests and all four integrity reproducers. All passed with the **final** migration installed. The isolated credential guard also rejects hosted/wrong-port/wrong-database/wrong-role verifier/extractor URLs before connecting.

Final TypeScript/build gates passed; lint had zero errors and one existing unused-tokenize warning. `git diff --check` passed. Browser interaction coverage remains incomplete as described above; this is not a merge-ready release. See [engineering review](SPRINT_5_ENGINEERING_REVIEW_2026-10-09.md). Commissioning and prior uncommitted documentation were preserved. PROGRESS updates remain uncommitted for user review.
