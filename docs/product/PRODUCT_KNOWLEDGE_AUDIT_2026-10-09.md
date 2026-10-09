# LINEHORSE / SITEPM Product Knowledge Audit

Date: 2026-10-09. Scope: documentation only. Audit branch: `codex/product-knowledge-audit`; baseline `61fd8fcc49046aea77601100905daa0ec72abe42` (Sprint 6). [Product record index](README.md).

## Findings

The repository contains a coherent operational foundation: company-authorized projects/tasks/field evidence, operational follow-through and lookahead, hardened scheduling/resources, immutable versioned documents with source retrieval, and the Sprint 6 visual system. These have specific recorded isolated/automated/browser acceptance. **They are not evidence of production release of Sprints 3–6.**

The newly supplied discussions materially expand the preserved requirements for reviewer-verified construction progress, financial definitions, monthly pay applications, shared health dashboards, client publication and selective offline operations. These are **future capabilities**, not overlooked existing implementations. Their dependencies and approval decisions are now explicit. Nothing in this audit changes product architecture or authorizes a feature sprint.

The four PR heads were checked through GitHub metadata. Sprint 3's receipt fix is published at `229f3af`; Sprint 4–6 trees still descend from original Sprint 3 `44e5bda`. Successful compatibility overlay testing does not integrate that ancestry. Production release remains **NO-GO** because backup/recovery and other release gates are not verified. No production was accessed to establish deployment or live schema state.

## Evidence reviewed and limits

| Source class | Reviewed evidence | What it establishes / does not establish |
| --- | --- | --- |
| Supplied product direction | Both verbatim [handoff](sources/LINEHORSE_PRODUCT_VISION_ROADMAP_HANDOFF_2026-10-09.md) and [addendum](sources/LINEHORSE_KNOWLEDGE_AUDIT_ADDENDUM_2026-10-09.md) | Owner-provided intent/discovery/status correction; no access to the earlier chats or independent customer interviews |
| Existing canonical records | PRODUCT_VISION, ROADMAP, PRODUCT_ARCHITECTURE, DATA_INGESTION_ARCHITECTURE, DATA_SOURCE_REGISTRY, SITEPM_BUILD_SPEC, private beta guide, design system and long-term rule | Product breadth, original MVP scope, privacy/provenance, design and commercial intent; historical next-step statements require dated interpretation |
| Progress and pending documentation | Tracked PROGRESS chronology plus current main/Sprint 4/5/6/receipt worktree updates, pending roadmap/final-review/release documentation | Chronological implementation/discovery record; pending entries are not approved/committed release facts. Original files preserved |
| Git and PRs | Local ancestry/log through 61fd8fc, separate 229f3af fix and live read-only PR #3–#6 metadata | Published heads, open/draft state and dependency ancestry; not production deployment or a new independent engineering signoff |
| Application paths | Auth context, project/job desk/lookahead, task/report persistence/drafts, schedule types/actions/logic, document management/actions/transport/verifier, Ask retrieval/grounding/PDF extraction; route/component inventory and targeted searches | Specific implemented workflows and absence of identified finance/client/offline models in inspected definitions. Not a line-by-line security review of every file |
| Schema and security definitions | Core SQL (companies/profiles/projects/tasks/field logs), Week 6/7 documents/extractions/chunks, Week 11 report crews/photos/schedules/dependencies, Sprint 3–5 migrations and separate receipt follow-up | Declared table relationships/RLS/write boundaries and missing scope/billing/portal models. No live database schema/ACL audit or new migration execution |
| Acceptance and tests | Sprint 2/3 implementation/release records; Sprint 4 engineering review/hardening and reproducer assertions; Sprint 5 plan/implementation/browser/review; Sprint 6 report/screenshots; receipt investigation and test assertions | Previously recorded unit, isolated DB/Storage, concurrent/tenant and browser evidence, with limits. **No application tests/build/browser/database tests were rerun in this documentation-only audit** |
| Reference material | Reference Project 001 and Sprint 6 screenshot/asset provenance records | Static fictional lifecycle benchmark and isolated visual evidence; not real customer, installed-work or property-runtime evidence |

No inaccessible historical ChatGPT conversations, complete customer call transcripts, live production database/Storage/Railway state, accounting exports, final logo asset, trademark clearance or verified current paid-customer metrics were supplied. The audit makes no claims of reviewing them. Database review means repository SQL/security definitions and recorded isolated results, not a production connection.

### Exact release candidates observed

| PR | Published head | Target / ancestry | State |
| --- | --- | --- | --- |
| [#3](https://github.com/torrescarroll-droid/SITEPM/pull/3) | `229f3af9d68ca6de973fa6426b608ec54245b004` | main; observed main baseline `12a0615a73f95745173173b6e5661b74e556e16f` | Open, not draft, not merged |
| [#4](https://github.com/torrescarroll-droid/SITEPM/pull/4) | `870f9a269934e03bc3f7abdc6775bc679b72b6ee` | codex/field-data-reliability; head ancestry contains `44e5bda`, not `229f3af` | Open, not draft, not merged |
| [#5](https://github.com/torrescarroll-droid/SITEPM/pull/5) | `5f3403a65ef4fd3090684682d8e65c5819c30b37` | codex/construction-scheduling / 870f9a2 | Open, draft, not merged |
| [#6](https://github.com/torrescarroll-droid/SITEPM/pull/6) | `61fd8fcc49046aea77601100905daa0ec72abe42` | codex/documents-project-intelligence / 5f3403a | Open, draft, not merged |

PR metadata for #4 still returned base snapshot `44e5bda`; #3's published head is `229f3af`. The relevant actionable fact is local head ancestry, not assuming a PR base snapshot has integrated the new fix. Retarget/reconcile and test actual release candidates after approved earlier releases. This audit branch deliberately does not merge/cherry-pick implementation changes.

## Capability reconciliation

The [66-entry inventory](FEATURE_INVENTORY.md) classifies current operational, scheduling, document, intelligence, finance/client, offline/lifecycle, business and release capabilities. The [requirements](PRODUCT_REQUIREMENTS.md) define ten connected contracts with security, future acceptance and dependencies. Important reconciliations:

1. **Verified progress is missing as a workflow.** Reports/photos/tasks are useful evidence, but no approved scope-value/quantity model, authorized verifier, review/reversal lifecycle or auditable construction-completion calculation exists in inspected schema/routes. Current lookahead returns task/schedule done counts; those cannot become physical completion or earned value.
2. **Financial tracking and monthly billing are missing.** No SOV/approved contract-change baseline, cost/commitment ledger, pay-application/retainage/prior-billing/payment workflow or verified accounting connector. The anecdote supplies discovery, not accounting rules. Separate all financial measures before design.
3. **Role-appropriate dashboard foundation is partial.** Existing dashboard/overview/portfolio calendar answers operational questions. It does not implement shared verified budget/progress/client metrics or granular finance disclosure. Current profile role is one of owner/admin/PM/superintendent/field; current company checks are not a full project-member/action matrix or client portal.
4. **Client portal is future.** No client identity/invitation/publish/revoke boundaries established. Resource directory participants are not external users. Client sharing must protect originals, versions, chunks, citations, aggregates and history, not just navigation.
5. **Offline is future.** SessionStorage recovery, request identity and TUS resumability provide foundations. No durable offline queue, service-worker read pack, cross-session sync, local encryption/revocation policy or actual poor-network phone acceptance is established.
6. **Scheduling foundation is real; master/CPM is future.** Dates/timezones/IDs/predecessors/assignments/revisions/history support extension. They do not supply durations, dependency-type/lags, project calendars, formal approved baseline, actual labor, float/critical-path engine or automatic downstream propagation. Supporting those requires deliberate schema/algorithm evolution, not necessarily a platform rewrite. This audit selects no new schema.
7. **Document foundation is real; federation and approval intelligence are future.** Versions, hash verification, explicit current selection, archive/restore, typed links and bounded PDF citations exist. OCR, structured drawings, external source sync and approved-for-construction approval are not established. Unsupported/non-PDF processing limitations remain explicit.
8. **Sprint 6 is the visual baseline.** Tokens, shared patterns, responsive operational screens and before/after evidence exist. Mockup financial/equipment/search/notification displays are not shipped features. The provisional horse preference is not an approved asset. Multi-role clarity extends the baseline rather than changing it.
9. **Long-term architecture remains intact.** Toolbag, multilingual voice, field-to-office, estimating, procurement, company learning, Property/closeout/service, licensed construction/regulatory knowledge, relational graph and controlled agents remain preserved with privacy and authorization gates. No idea becomes authorized merely through this inventory.
10. **Commercial direction needs evidence.** Private beta, ten paying companies, April 2027 and $99–149/company/month are target/experiment, not traction, forecast, public price list or entitlement design.

## Source-to-record coverage

| Provided / existing source | Preserved in current record |
| --- | --- |
| Handoff §§1–3 | A01–A03/A08/A09; R01/R09; F01–F09/F46–F56/F63–F66: north star, many roles, operational and long-term domains |
| Handoff §4 | D01/Q07; R06; F10–F20: implemented scheduling vs future master/Gantt/CPM |
| Handoff §5 | D02/Q08; R07; F21–F32: managed documents vs federation |
| Handoff §6 and addendum §4 | A11/Q09; R08; F07/F24/F41/F42: selective offline and truthful recovery |
| Handoff §7 and addendum §3 | A07/A08/Q11; R10; F43–F45; design principles: retained visual baseline and provisional mark |
| Handoff §8 and addendum §5 | A04/A13/Q12; F06/F61; exact PR table and staged migration/release risks |
| Handoff §§9–11 | D05/Q01/Q10; R10; F57–F60: private beta, commercial experiments, source/provenance and decision backlog |
| Addendum §§1–2 | D03/D04/A10/Q02–Q06; R02–R05; F33–F40: evidence-backed progress, finance, monthly billing, common health and restricted client views |
| Addendum §6 | Audit methodology, status legend, source gaps, documentation-only branch/diff and preservation checks |
| Existing architecture §§4–17/25–33 | F46–F55/F63–F66 and R09: Toolbag, voice, bilingual, estimates, procurement, communications, field intelligence, property/service, APIs/physical AI |
| Existing architecture §§18–24/34–36 and ingestion/registry | F26–F32/F51/F52/F54/F56 and R07/R09: knowledge classes, licensing, longitudinal evidence and privacy |
| Existing tests/progress/sprints/Git | IV/IL/P boundaries with named engineering reports; current vs historical release/acceptance distinguished |

## Contradictions and undocumented boundaries

| Finding | Evidence / resolution in this documentation |
| --- | --- |
| Architecture time layer says Stage 4 not started/no PDF; later code/PROGRESS and Sprint 5 clarification show PDF extraction/citations | Added a dated reading note, retained historical text and linked current inventory. No new Ask authorization. AGENTS/long-term rule Stage-3 wording should receive a separate owner-consistent instruction update; not silently rewritten here. |
| Roadmap initial Sprint 5 row says browser acceptance pending, later Sprint 6 paragraph says passed | Preserved chronological rows and added current dated table linked prominently. 5f3403a browser completion supersedes earlier blocker; remaining limits retained. |
| First handoff / release-preparation notes still show Sprint 3 receipt concern unresolved | Addendum and actual 229f3af implementation/report supersede status. Original release notes left untouched; audit records fix and remaining production gates. |
| Original Sprint 3 release expectations assumed invoker-only RPC; hardened path uses bounded definer | Current receipt fix defines narrow NOLOGIN/NOBYPASSRLS owner/private identity bridge and removes client receipt DML. ACL preflight must follow new reviewed design, not stale expectation. No generic security-definer bypass permitted. |
| Published Sprint 4–6 branches do not include new Sprint 3 fix in ancestry | Record compatibility overlay separately; final integration/review/merge-candidate tests required. No branch rewrite undertaken. |
| “Verified” can mean bytes, source fact, physical work or financial approval | Added explicit terminology and workflow requirements R02–R05/R07. No existing label retroactively certifies work. |
| Role labels/company scope can be mistaken for full enterprise/client access | Current authorization boundary documented; proposed matrix Q02 requires its own approval, migration and tests. |
| Current document/changed remote drawing could be mistaken for approved construction instruction | Preserve explicit promotion semantics; future approval/distribution/federation decisions remain open. |
| Draft recovery can be mistaken for offline capability | Explicit state/queue/security/device requirements recorded, no offline capability claim. |
| Superintendent lens could exclude other roles; mockup could imply built modules | Retained visual language plus Clarity at Every Level and responsibility-based future views; no new screens/permissions. |
| Older front-facing logo exploration vs newer profile preference | Both retained as exploratory; newer right-facing preference recorded, no approved asset or UI replacement. |
| Schedule reference originally unavailable vs later Sprint 6 supplied mockup | Historical availability statement retained; mockup is now Sprint 6 design evidence, not retroactive Sprint 4 testing or feature scope. |

## Missing requirements now captured and remaining gaps

**New durable requirements:** R02 physical review/provenance/reversal; R03 measure dictionary and baseline integrity; R04 monthly approval/payment lifecycle; R05 shared definitions and private client publication; R06 master-schedule discovery/actual-vs-planned; R07 external version/revocation/source authority; R08 durable selective offline states, byte integrity/conflicts/device privacy; R10 beta metrics and design clarity. Existing R01/R09 architecture guardrails are made explicit rather than replaced.

**Still requiring input:** Q01 priority; Q02 permissions; Q03 measurement/verification; Q04 billing/accounting rules; Q05 actual accounting products; Q06 client visibility; Q07 master scheduling/recalculation; Q08 federation; Q09 offline scope/security; Q10 beta/pricing; Q11 brand approval; Q12 release execution. See [decision table](DECISIONS_AND_DISCOVERY.md#decisions-requiring-owner-input-before-related-implementation) for rationale and research. Detailed calculations, schemas, connector agreements, permission matrix and legal/accounting rules are deliberately not invented.

**Source gaps:** missing original Projects PM/other conversation transcripts, real anonymized schedules/SOV/pay requests, confirmed Microsoft/“Buildermaster” product names, concrete client/finance role scenarios, device/security requirements, customer validation and brand assets/clearance. If supplied later, register dated sources and contradictions; do not silently rewrite accepted direction.

## Release and security risks retained

- Protected database **and Storage object-byte** backup/actual isolated restore and reconciliation are unverified. Restricted extractor credential is not complete backup capability. No secret inspection or new production credential search in this audit.
- Explicit staged migrations: `20261008054310_field_report_atomic_save.sql` → separate Sprint 3 `20261009214540_field_report_receipt_integrity.sql` → `20261008163441_construction_scheduling.sql` → `20261008201434_scheduling_integrity_boundary.sql` → `20261009010546_document_management.sql`. Later receipt filename timestamp does not justify exposing original vulnerable grants until the end. Sprint 6 has no migration.
- Require correct project/schema/data-adoption/role/table/column/function/search_path/RLS preflight, restricted verifier configuration, continuous report cutover pause and incompatible schedule/document write pauses. Drain old tabs/clients. Do not treat an old-app rollback as safe against new write boundaries or regrant vulnerable writes.
- Original pre-fix receipts remain untrusted; uncertain historical saves need review, not blind new-key creation. Legacy direct report/crew saves retain nontransactional limits.
- Railway deployment/configuration/autodeploy/build/rollback checks and independent review of actual integrated SHAs remain. PRs #5/#6 are draft. The prior release-preparation record reported no GitHub checks/reviews; this audit refreshed PR heads/draft/merge state, not those check/review endpoints.
- Company-scoped scheduling serialization is intentionally conservative; contention/timeouts need pilot/load evidence before capacity claims. Existing bounded document work-record queries and pagination/history windows also limit large portfolios.
- No new physical-device, cellular, broad assistive-technology or large-company performance proof. Existing non-PDF browser/antivirus/processing and pagination/lifecycle limitations remain. Future offline/client/finance features must not inherit a stronger assurance claim than actually tested.

## Documents created or updated

Created small canonical set under `docs/product/`: index/status/provenance; requirements; 66-capability inventory; combined decision/customer-discovery log; design principles; this audit. Preserved exact supplied handoffs under `sources/` with SHA256 manifest. Existing PRODUCT_VISION, ROADMAP, PRODUCT_ARCHITECTURE and LINEHORSE_VISUAL_SYSTEM receive dated, linked additions; original decisions remain. Appended Done/Next/Blocked in this isolated branch's PROGRESS only.

No application code, dependency, database schema/migration, RLS, authorization or environment change. No production access, new DB testing, merge, deployment or external communication. All original worktree modified/untracked files were hash-snapshotted before edits and checked afterward, including commissioning and pending PROGRESS/roadmap/release records.

## Validation and review gate

Documentation validation passed: 92 local file/heading links; 66 unique capability IDs; both attachment copies byte-identical with SHA256 manifest; whitespace check on authored documentation (verbatim source handoffs retain their five original Markdown hard-break lines); 14 changed documentation files within the allowed scope; all 15 original modified/untracked files unchanged by SHA256 comparison. Existing application test/build evidence reviewed, not rerun because no application behavior changed. Documentation has not been committed/pushed; the supplied handoff §10.8 explicitly requires owner authorization of a clean documentation update. The investigation has finished, but that publication approval has not been inferred. PROGRESS separately remains uncommitted under project rules.

**Audit outcome:** product knowledge is review-ready with explicit source gaps and decisions. **Production readiness remains NO-GO.** Next action is owner review of the proposed documentation diff and priority/definition questions, then an authorized documentation-only commit/publication excluding PROGRESS unless separately approved. No new sprint starts automatically.


## Publication authorization — subsequent owner instruction

The owner explicitly authorized publication of this completed audit on `codex/product-knowledge-audit`, with a final documentation-only review and **PROGRESS.md excluded**. This supersedes the publication hold described above; it does not authorize application, schema, production configuration, merge or deployment changes. The approved publication consists of 13 documentation files: the four existing vision/roadmap/architecture/design records and nine product-record/source files. Final scope, 92 local links/headings, 66-capability count and sensitive-value checks passed; existing uncommitted work remains preserved. The staged whitespace review flags only five original two-space Markdown hard breaks in the verbatim handoffs; those are intentionally preserved to retain byte-identical source provenance. Commit and remote verification are reported separately after publication.
