> Implementation authorization: the user approved Sprint 5 after this proposal, including immutable versions with explicit current promotion; company/project access; archive/restore; PDF/JPG/PNG and safe common Office formats; metadata search and existing PDF/Ask provenance; exact-version work links; explicit limits and processing controls. The proposal below is retained as planning history. Where it says PDF-only or awaiting approval, the later authorization governs. Implementation and actual verification are recorded in `DOCUMENTS_PROJECT_INTELLIGENCE_SPRINT_2026-10-09.md`. This does not authorize release.

# Sprint 5 proposal — Documents & Project Intelligence

Status: **PLAN FOR REVIEW ONLY. Implementation is not authorized by this document.**

Prepared against Sprint 4 commit `870f9a269934e03bc3f7abdc6775bc679b72b6ee`, 2026-10-08. Product principle remains: capture construction reality once, turn it into useful intelligence everywhere, preserve it for the life of the property. This sprint proposes tenant-private project records, not a new property ownership/access product.

## 1. Milestone and operational outcome

Build a reliable, versioned project document desk. A superintendent should find the current plan/specification, upload its replacement without losing the old issue, link the exact source to scheduled work or a field follow-up, and retrieve relevant project text with an identifiable document/version/page. Upload or extraction interruptions must never imply success or cause the current usable version to disappear.

This is one connected workflow: capture → validate → preserve → organize → use on the job → retrieve with provenance. Basic uploading, browsing and finding files must work without AI or an extraction credential.

## 2. Actual repository baseline and reuse

| Already present in committed code | Sprint 5 gap / proposed reuse |
| --- | --- |
| `documents`, private `project-documents` bucket; company/project RLS, PDF-only 20 MiB; filename/path constraints; uploader/hash/size | Preserve IDs, bytes, bucket and paths. Strengthen mutation/finalization guarantees; do not rebuild upload as a separate repository. |
| `lib/document-actions.ts`: pending metadata → Storage upload (no upsert) → ready; failure handling; authorized 60-second signed opens | This spans database and object storage and is not atomic. No stable retry identity; a stored-but-not-ready failure currently suggests re-uploading. Provide recoverable attempts and verified finalization. |
| Company/project document pages and category lists | Add current-version list, metadata editing, bounded pagination/filter/search, issue history, archive/restore and useful status feedback. |
| Immutable canonical file identity, status-only updates; no client object overwrite/delete | Keep each physical file immutable. Versioning must not overwrite existing rows or Storage bytes. |
| `document_extractions`, `document_chunks`, page locators/source SHA, restricted `sitepm_extractor` write RPC | Reuse derived evidence and provenance. Add visible extraction state/retry and per-version indexing; do not duplicate extraction tables. |
| PDF parser child-process limits and best-effort extraction after ready upload | Preserve upload success independently of extraction. Reuse parser limits; expose unsupported scan/encrypted/error states accurately. |
| `search_project_document_chunks`, lexical query decomposition, `lib/ask-retrieval.ts` feeds page-based evidence into Ask with scope checks/citation allowlists | Search/Ask PDF text integration already exists in code. Make retrieval version-aware and expose a deterministic search UI; do not label this as a greenfield PDF/AI implementation. |
| Existing tasks, field reports/photos, scheduling resources/activities/lookahead | Add explicit same-project document references; do not convert a PDF into a task, approved change order, actual attendance or schedule change. |

Parts of `docs/PRODUCT_ARCHITECTURE.md` and source comments still say PDF intelligence is not implemented/not wired. The actual upload and Ask call sites contradict those historical descriptions. At sprint start reconcile documentation with code, test fixture evidence and separately verified deployment/configuration; do not infer production feature availability from repository presence. Preserve previous architecture decisions as historical context. No production inspection was done for this plan.

## 3. Proposed functional scope

### Upload and recovery

- Keep PDF-only, 20 MiB as the default scope; show the limit before selecting a file. Validate bytes, MIME, safe filename, size and parser safety on the server. A PDF header alone is not a malware guarantee.
- Begin a stable, actor/company/project-scoped upload attempt. Never accept client company, verification result or a claim that a file was stored.
- Show progress and distinguish uploading, stored/verification pending, ready, failed, and retry required. Disable repeat submission while pending. Confirm only after database finalization commits.
- Use resumable transport for files larger than 6 MB or unreliable networks where supported; a small pinned TUS client is justified if needed. Retain immutable object paths and no upsert. Verify real Storage RLS/resumption behavior before selecting the library/API.
- On reload, recover attempt metadata, not a promise to recover browser file bytes. If needed ask the user to reselect the same file and verify its identity. Scope local recovery data to account/company and clear it on logout/account switch. Never persist bearer upload/signed URLs in shared logs.
- Retry the same verified attempt rather than minting another current version. Different payload under the same request rejects. Interrupted uploads and orphaned objects remain visibly pending/unpublished until reconciliation.

### Organization and version history

- Reuse existing categories; add human title, optional trade, flat project collection/folder and notes. Prefer one level of collections initially; defer nested folder trees, automatic classification and custom taxonomies.
- One logical document groups immutable file versions. Each version has a stable canonical `documents.id`, checksum, uploader/time, optional issue label/date and a monotonic family version number. Issue dates are user-recorded metadata, not invented effective dates or approval.
- Upload replacement → verify bytes → review → explicitly publish as current. Existing current stays current until successful promotion. Failed replacement cannot hide it.
- Display current/previous, issue label, uploaded/issued dates and source status separately. Historical files remain accessible to authorized users with an obvious superseded label.
- Concurrent promotions require expected family revision; exactly one succeeds. Version numbers are allocated under a family row lock and unique constraint, not `max()+1` outside a transaction.
- Archive/restore is recoverable visibility control. No hard deletion or automatic object purge in this sprint. Archive is not a legal retention/destruction policy.

### Project and workflow integration

- Provide a project document desk and company index with explicit project filter, paginated list, detail/history page and mobile upload/find/open flows.
- Link a logical document or a pinned file version to a task, schedule activity or daily report. Default evidence references pin the exact version; any “follow current” planning reference must be explicitly labelled and resolved on read.
- Show “newer version available” without silently changing the source behind historical evidence. Linking/removal must be auditable and authorized for both sides.
- Surface linked documents on the relevant task/schedule/report and project overview. A field photo remains in the existing photo workflow; linking its report must not create duplicate photo uploads.
- A document labelled schedule/change order is source material only. No automated schedule rescheduling, task completion, cost changes, approvals or external messages.

### Search and dependable intelligence

- Always-available metadata search: title, filename, category, collection, trade, issue label/date. Server-side bounded queries and pagination, tenant/project predicates before ranking/counts.
- Reuse PostgreSQL chunk FTS and current lexical retrieval for digital-PDF content. Return a short excerpt, exact file version, page locator and direct authorized open. Provide metadata fallback when extraction/search is unavailable.
- Default results/Ask to current, ready, unarchived versions. Explicit historical mode labels superseded results. Do not infer “as-of” accuracy from upload time or nullable issue dates; historical snapshot queries require the current-version timeline and explicit semantics.
- Extraction state is distinct from canonical readiness: queued, processing, searchable, unsupported or failed/retryable. Textless scans/drawings remain stored and usable but are not falsely called searchable. No OCR or drawing interpretation promise.
- Current Ask must retain project/company checks, evidence budgets, page/version/hash provenance, citation allowlists and prompt-injection defenses. No new model dependency for basic workflows. Existing AI answers cannot silently mix obsolete revisions with current instructions.

## 4. Proposed data architecture (review before implementation)

Use additive PostgreSQL entities, not a separate document database or vector platform.

| Entity | Proposed purpose and integrity |
| --- | --- |
| Existing `documents` | Immutable canonical physical file/version. Preserve all existing IDs, paths, hashes, extraction FKs and citations. |
| `document_families` | Company/project logical identity, title/category/collection/trade, archived state, current document pointer, revision, creator/update actor/timestamps. Current pointer must identify a verified ready version in this exact family/company/project. |
| `document_versions` | Membership of canonical document ID to family, version number, issue label/date and promotion state. Unique physical membership and family/version; composite FKs prevent cross-project/company linkage. |
| `document_upload_attempts` | Actor-bound idempotency key, proposed canonical ID/path, expected payload/hash/size, attempt state, verification result, safe error code and timestamps. No client-forgeable verified/ready state or successful-save receipts. |
| `document_events` | Append-only family/version/upload/promotion/archive/link changes with actor and timestamp. Do not store full confidential file contents in audit metadata. |
| Typed document links | Same-company/project links to tasks, schedule activities and field reports using actual composite FKs/guards. Avoid an unenforceable arbitrary `entity_type + entity_id` relationship. |
| Existing extractions/chunks | Remain bound to immutable canonical document ID/hash; retrieval joins membership/current/archived visibility. Any processing job adds source ID/hash/version and extractor version, not a second corpus. |

Backfill legacy documents deterministically as one family/version each, retaining canonical IDs and paths. Preserve failed/pending rows as attempts/legacy records with explicit state; never fabricate readiness. Do not group similar filenames or hashes into families automatically. Existing upload timestamps become upload history only. Avoid claiming pre-adoption promotion/audit history exists.

A single database-enforced boundary must cover family metadata, version publication, verification state and links. Default to invoker RPCs when grants safely enforce invariants; if revoking direct DML requires a definer, use a separately reviewed, non-login/non-owner/NOBYPASSRLS role with minimum grants, empty search_path and explicit EXECUTE ACLs. Do not reuse or broaden the scheduling writer. Existing privileged extractor is a trusted backend capability, not a tenant-user endpoint: inspect its global-document write reach and explicitly bind any future jobs to authorized immutable identities; do not expose its credential in clients or treat it as general DB access.

Object storage and PostgreSQL cannot share a single ACID transaction. Use an explicit recoverable upload state machine: begin pending → upload immutable object → server verifies actual stored bytes/hash/size → transactional finalize/publish/audit/receipt. Failed verification/promotion leaves the prior current intact. A sweeper may reconcile metadata and report orphan candidates; physical deletion requires a separate retention decision. Repeated finalize must be idempotent. No authenticated direct status update may forge ready/verified or publish another attempt.

Protect current-pointer/version FK relationships, family identity, immutable file identity, valid state transitions, uniqueness and expected revision in the database across every permitted write path. Locks should be per family/upload, not company-wide unless evidence requires it. Index company/project/state and family/version keys; reuse FTS GIN indexes. Search and list must use stable pagination and bounded indexed queries, not full-company client downloads.

## 5. Security and access-control contract

- Preserve the existing authenticated company/project authorization model. Current projects are company-visible; there is no demonstrated project-membership ACL. Do not advertise private-to-one-manager contract folders without implementing and approving that separate model.
- Initial proposed access inherits current project permissions. Company B cannot read metadata, bytes, versions, link targets, snippets, counts, audit or upload states from Company A. Project A search/Ask cannot include Project B even when both belong to one company.
- Resources/subcontractors are directory records, not authenticated users. No subcontractor/client/owner portals, anonymous sharing or external access grants are included.
- Storage policies must validate exact canonical object/attempt and operation, not merely a company/project path prefix. Current helper permits project-prefix objects and does not verify canonical readiness/registration; strengthen this before claiming registry-only reads. Distinguish permitted pending upload ownership from ready/historical read access.
- Short-lived signed opens require a fresh authorized lookup; no public bucket, arbitrary path signing, URL in logs or indefinite URL caching. Already-issued URLs may remain usable until expiry, and downloaded bytes cannot be revoked. Archive/revocation semantics must acknowledge this window.
- Do not broaden service-role use. Client credentials cannot create trusted receipts, verify bytes, forge extractors, edit audit or bypass current-version constraints. Actor identities come from the session, never client input or user-editable metadata.
- Server verifies bytes with bounded memory/time and existing PDF parser isolation. Rate/size/count limits protect upload/search/extraction. Never execute embedded PDF scripts/attachments. New security scanner/vendor or raw-document third-party processing requires approval; without scanning do not claim malware certification.
- Source text is untrusted data. Prompt injection cannot expand project scope, citations, tools or permissions. Retrieval follows current-version/archived policy at query time; caches include tenant/project/version scope.
- Recovery/backups must cover both database metadata and actual Storage blobs. pg_dump alone does not preserve bucket object bytes. Credentials, local test keys and signed URLs stay outside Git; restoration is isolated and never overwrites production during testing.

## 6. Implementation sequence and dependencies

| Phase | Work and exit condition | Depends on |
| --- | --- | --- |
| 0. Plan gate/baseline | User reviews scope/decisions; inspect then-current main; reconcile document architecture status; inventory actual policies/functions/config without changing production | This proposal accepted; no implementation before that |
| 1. Isolated Storage test environment | Separate disposable Supabase stack with real Storage/object service; synthetic A/B users and PDFs; seeded test corpus, no production copies | Docker capacity/ports; current CLI configuration; no hosted credentials required for local setup |
| 2. Schema/security | Add families/membership/attempts/events/typed links; deterministic legacy backfill; enforce mutation/Storage boundaries; role/search_path review | Baseline inventory, approved version/access semantics |
| 3. Reliable upload/version workflow | Start/resume/reselect/verify/finalize; retries and concurrent promotion; current version survives failure | Real isolated Storage acceptance, schema |
| 4. Document desk | Current/history/details/collections/filter/archive/restore and mobile states | Persistent upload/version contract |
| 5. Operational links | Exact-version references and newer-version indicators on task/schedule/report/overview | Sprint 3/4 models and typed link constraints |
| 6. Search/extraction visibility | Metadata search always available; reuse PDF FTS; extraction status/retry; version-aware Ask/citations | Trusted extraction environment or explicitly reported derived-index blocker |
| 7. Acceptance/release preparation | Full security/failure/browser/regression suite, performance evidence, docs, feature commit/PR | All mandatory acceptance below; release authorization separate |

Recommended branch: create `codex/documents-project-intelligence` from reviewed Sprint 4 once this plan is accepted. If Sprint 4 remains unmerged, stack explicitly on it and target that branch for isolated diff; do not merge Sprint 4 into Sprint 3. Rebase/retarget only after ordered releases. Document management itself does not require the field-report RPC, but links and repository ancestry depend on the accepted Sprint 3/4 models. No release is implied by development permission.

The current isolated scheduling stack excluded Storage/blob services. Its success does not constitute Sprint 5 upload/download acceptance. Reuse guards and fixtures but establish a separate Storage-capable environment without resetting existing volumes. Restricted extractor credentials/config may be absent locally; test with a dedicated local trusted executor, never borrow production credentials. If a hosted test project, additional billable services or credentials are needed, block only that dependent portion and report it.

## 7. Acceptance matrix / definition of done

| Area | Required acceptance |
| --- | --- |
| Upload | Valid PDF, empty/oversize/spoofed MIME/header, unsafe filename, malformed/encrypted/textless/huge-parser input. Byte/hash verification; progress; exact replay; same request/different payload rejects; actual stored bytes mismatch rejects. |
| Failure/recovery | Interrupt before object upload, during transport, after storage but before finalize, after commit before response; refresh/reselect same file; repeated/concurrent retries produce one canonical version; old current remains usable; visible orphan/pending state; no false success. |
| Versions/concurrency | Two simultaneous replacement/promotions: one expected-revision winner; no duplicate version number or invalid current pointer. Old bytes/hash/citations unchanged; failed replacement retains current; archive/restore preserves history; direct SQL/API attempts cannot bypass publication. |
| Authorization | A/B metadata/Storage/list/download/signed URL/resume/finalize/history/search/count/link isolation; anonymous denial; wrong uploader/project/family/current pointer; direct ready/verified/audit/receipt forgery; unchanged role privileges; expired URL; documented already-issued URL window. |
| Project links | Same-project tasks/activities/reports link/open correctly; cross-company and same-company cross-project references reject; pinned references remain pinned after promotion; never auto-complete/reschedule work. |
| Search/intelligence | Metadata without extraction/model; current default and explicit historical search; matching page/version/hash; superseded exclusion in Ask; archived exclusion; no-hit versus unavailable distinction; punctuation/trade terms; prompt injection, invented/other-project citations, extractor unavailable and parser limits. |
| Organization | Existing legacy PDFs retain ID/path/access; deterministic backfill rerun safeguards; pagination across more than API default page cap; no missing/duplicated results under defined sort; category/collection/trade filter correctness. |
| Browser | Desktop and emulated 390/320-pixel layouts; keyboard labels/focus, upload progress and disabled controls, confirmed publication, error/retry/reload, history and version warnings, archive confirmation, search/open, A/B account switch cleanup. Report physical-device coverage separately. |
| Database/release | Fresh canonical+Sprint 3+both Sprint 4+Sprint 5 replay; representative populated upgrade; rollback failure injection; privilege/security advisors; no destructive schema reset. Test proposed compatibility/read-write block behavior on previous app before release. |
| Regression/quality | Sprint 3 report/crew/recovery, all four Sprint 4 integrity cases, schedule/lookahead/tasks/auth/dashboard/photos, existing Ask/lexical and PDF extraction/search suites; TypeScript, lint and supported production build. Hosted scripts are opt-in only to a named isolated project. |
| Performance | Record query plans, page counts and timings for proposed pilot fixture of 1,000 logical documents/25,000 chunks. Agree latency budget before acceptance; do not claim large-company scale from a tiny synthetic set. |

Done means a reviewed feature PR, reproducible database + Storage acceptance, useful UI and manual, accurate test/limitation record and migration/recovery plan. Any missing mandatory isolation, real-Storage or transaction/retry acceptance blocks readiness. No production test records, production migrations, merge or deployment without explicit authorization.

## 8. Decisions for plan approval

| Decision | Recommended scope | Why approval matters |
| --- | --- | --- |
| Logical version semantics | Existing canonical file IDs remain immutable; explicit current promotion, pinned historical evidence, old versions retained | Defines what “current” means operationally and prevents accidental evidence rewriting |
| Access model | Inherit existing company/project access for Sprint 5; no external/private-folder ACL promises | Restricted contracts or project-membership roles would change the authorization architecture and require separate approval/design |
| Retention/deletion | Archive/restore only; no automatic permanent purge | Retention/destruction is a business/security policy, not a routine cleanup decision |
| File formats/cap | PDF-only 20 MiB; resumable upload and metadata fallback | Larger plans, Office files, images and CAD/BIM introduce different validation/viewing/capacity requirements |
| Intelligence boundary | Reuse digital-PDF extraction/search/Ask already in code; version-aware provenance, no new autonomous actions | OCR/drawing understanding, new model/vendor transmission or wider corpus ingestion requires explicit authorization |
| Infrastructure/cost | Local Storage-capable tests first; reuse PostgreSQL FTS and existing executor where safe | Hosted provisioning, workers/scanners, paid services or new credentials must be reviewed before commitment |

Implementation details within the accepted contract (component layout, indexes, bounded RPCs and a minimal pinned transport library) are routine engineering choices. Changes to access/retention semantics, third-party data processing, property rights, new privileged executor reach or production release require explicit approval. This proposal is not that approval.

## 9. Future intelligence architecture / deliberately deferred

Immutable versions, hashes, locators, issue/promotion history and typed operational links enable later revision comparison, RFI/submittal traceability, document-to-schedule impact review, warranty/closeout packets and evidence-grounded questions. Derived claims must carry exact version/page/hash, processing identity, uncertainty and a review state; source facts, inference and user approval remain distinct.

Do not implement OCR/vision, sheet extraction, CAD/BIM, engineering code interpretation, formal RFI/submittal/change-order workflows, financial approvals, external portals, emails, property schema/transfer, shared cross-tenant corpora, vector infrastructure or automatic schedule/cost changes in Sprint 5. Gantt/critical path/labor analytics remain the scheduling roadmap, not added here. No AI-generated plan instruction is authoritative construction approval.

Parallel commercial work remains customer discovery, beta recruitment and pricing toward ten paying contractors. Use pilot feedback to measure ability to find the correct issue, upload recovery success and source-link usefulness; do not divert this engineering sprint into marketing implementation.

## 10. Release and review checkpoints

No production changes now. Future Sprint 5 release requires ordered Sprint 3/4 releases, verified backup/restore of DB **and blobs**, current schema/ACL preflight, data-preserving legacy backfill rehearsal, agreed access/retention semantics and explicit release authorization. Additive schema alone does not guarantee old uploader compatibility: closing status/Storage grants may require a verified document-write maintenance block through migration and matching application deployment. If rollback is needed, preserve all bytes/history, keep incompatible writes blocked, and use a reviewed forward fix/recovery; do not regrant forged-publication paths.

Review this plan and decision table before starting implementation. This session creates documentation only and leaves it uncommitted for review.

## Reference checks

Repository files and canonical SQL are the baseline above. Current official Supabase guidance confirms operation-specific Storage RLS and additional permissions required for overwrite; this plan avoids overwrite: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control). Supabase recommends resumable transport for larger files or unreliable networks: [Resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads). The changelog was checked, including [PostgreSQL 15.19/17.11 changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes); this plan does not require the affected ltree/custom-operator/legacy-cipher features. These references inform the proposal, not a claim of implementation or production environment verification.
