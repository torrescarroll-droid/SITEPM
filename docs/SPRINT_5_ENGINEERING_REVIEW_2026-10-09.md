# Sprint 5 engineering review — 2026-10-09

Scope: inspected application actions, upload transport/recovery, document/current-version reads, work-reference UI, migration/backfill, RLS/function owners/ACLs, isolated Auth/Storage acceptance and Sprint 3/4 regressions. This is a code/isolated-environment review, not production preflight or an independent second engineer’s sign-off.

Verdict: **NOT READY for merge/release; publish as a draft for engineering review.** The known blocking acceptance gap is final browser save/recovery and complete mobile interaction coverage. Database/Storage acceptance is real and separate; mock/unit/HTTP tests do not replace browser acceptance. No production operation is authorized.

## Issues found and resolved during implementation

| Finding | Resolution and evidence |
| --- | --- |
| Old uploader separately committed metadata/blob/readiness and had no stable retry identity. | Transactional registration, immutable paths, resumable transport, server byte/hash verification and actor-bound trusted receipt. Interrupted confirmation and identical/concurrent retry acceptance passed. |
| Client-ready/status/receipt writes would allow claiming unverified file persistence. | Revoke direct DML and old status-column grant/policies. Non-owner NOBYPASSRLS writer + separate minimal verifier; actual forged client API/SQL attempts reject. No service-role workaround. |
| Empty-only replay missed deferred current-pointer FK events before later RLS ALTER. | Flush that membership constraint after legacy backfill. Populated ready/pending/failed replay passed without changing original IDs/paths/hashes/status/bytes. |
| PostgREST family join became ambiguous after new membership/current FKs. | Explicit composite-FK relationship hints in authorized lookups/work references. Built-app detail/project/work pages rendered under authenticated scope. |
| TUS signed token alone did not preserve the actor’s RLS identity. | Short-lived signature plus authenticated JWT in transport memory; no bearer token in saved checkpoint. Real local signed TUS/chunk/HEAD/resume/hash acceptance passed. |
| Existing extraction client required SSL even for local test PostgreSQL. | Disable TLS only for explicit loopback; continue requiring remote TLS. Real restricted parser/persist/FTS acceptance passed. |
| Current-version promotion could race with another editor. | Family row lock + opaque expected revision; exactly one concurrent edit succeeds and stale writes reject. New version allocation also serializes under family/company registration locks. |
| Referenced operational work could later move to another project. | Typed composite FKs across document/task/activity/report/company/project; target moves reject rather than corrupt evidence. All three reference types tested. |
| Capacity accounting initially trusted declared sizes, while Storage could retain a larger unverified object. | Reserve full bucket maximum per unverified/legacy file; only trusted verification releases unused space. Final limit acceptance uses 1-byte declarations to verify the 2 GiB reservation bound. Physical temporary/orphan Storage is not a hard billing quota. |
| Cached UI success could be lost if revalidation failed after persistence. | Confirmed persistence remains success; cache invalidation is best-effort. Already verified receipts recover without another Storage fetch. Actual action harness verifies this behavior. |
| Native document confirmation stalled browser automation. | New archive/promotion/link/draft confirmations use inline controls. Full final browser acceptance remains blocked by the runner’s failed click/keyboard dispatch; do not count that code change as proven acceptance. |
| Unused direct uploader remained a dead mutation path after revocation. | Remove obsolete upload action/form; retain authorized read entry point. Update historical extraction contract tests to the explicit processing flow and actual authorized lexical wrapper. |

## Security review

Company/project ownership is enforced by writer RLS and composite relationships. Writer owns no tables, has no schema CREATE after migration, and is not a client-role member. Public mutations have explicit EXECUTE ACLs and empty search_path/row_security=on. Trusted verifier can execute only verification/processing operations, not read tables. Private actor bridge delegates only auth.uid(); Storage helper returns only a scoped access predicate. API roles cannot mint receipts, audit rows, version membership or ready state directly.

Storage reads/uploads require registered same-company identities and unarchived state. No object overwrite or deletion path is added. Server-derived company/path/type and actual object byte validation protect finalization. Signed downloads expire after 60 seconds; previously issued URLs cannot be immediately revoked by archive. Original extractor remains a trusted global backend capability; credential compromise was an existing threat and requires secret/operational controls, not broader tenant grants.

Current-only chunk RLS prevents obsolete/archived candidate text entering ranking or Ask. Source IDs/hashes/locators are retained; no AI output is stored as verified source content. File hygiene is bounded format validation, not malware certification.

## Compatibility and release controls

Development ancestry is Sprint 3 `44e5bda` → Sprint 4 `870f9a2` → Sprint 5. Earlier migration files are unchanged. Field-report and all four scheduling integrity suites passed with the final document schema and quota fix installed; final clean replay and acceptance evidence is recorded in the implementation document.

Old document reads retain canonical identities. The legacy direct uploader is deliberately denied after migration, so pause document writes through migration and matching-app deployment; application-only rollback cannot safely reopen old writes. Preserve database and blob backups, existing history and isolated restoration. Do not regrant vulnerable DML, force migrations or delete retained data as a rollback.

## Remaining acceptance and operating risks

- Complete final built-app browser save/promotion/link/archive/search/recovery, desktop/mobile/keyboard and tenant switching before marking ready.
- Physical devices/cellular interruptions and production schema/Storage/configuration/backup-restore remain untested in this sprint.
- Metadata search is bounded substring search; 1,000-family/25,000-chunk latency/realistic concurrency budget remains to be measured. Latest-100 history and 200-per-type work selectors need future navigation at scale.
- Pending reservations are conservative and can exhaust a pilot company’s capacity; retained files are intentionally not automatically purged. Storage reconciliation, managed temporary upload lifecycle, alerting and a reviewed retention policy are prerequisites for broad rollout.
- No antivirus, Office preview/text extraction, OCR, offline queue, external/private-folder ACLs, as-of source reconstruction or advanced Gantt/labor/forecasting implementation is claimed.

Future intelligence can use immutable version identities, source hashes/pages, explicit issue/promotion history and typed work references. This supports additive document comparison, reviewed impact analysis and historical metrics without introducing model authority or duplicating operational records.
