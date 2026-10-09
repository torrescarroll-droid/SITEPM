# LINEHORSE product requirements

Recorded 2026-10-09 from the supplied [handoff](sources/LINEHORSE_PRODUCT_VISION_ROADMAP_HANDOFF_2026-10-09.md), [addendum](sources/LINEHORSE_KNOWLEDGE_AUDIT_ADDENDUM_2026-10-09.md) and existing [architecture](../PRODUCT_ARCHITECTURE.md). **Future requirements, not authorization to implement them.** Current delivery is classified separately in [inventory](FEATURE_INVENTORY.md). Open decisions use Q IDs in [decision log](DECISIONS_AND_DISCOVERY.md).

## R01 — Shared truth, identities and authority

Capture construction reality once; reuse it across authorized operational, management, financial and client views. Identity, authentication, authorization and workspace personalization are distinct. A simplified workspace must not grant privileges; a role label must not be treated as enforcement.

Preserve Next.js server architecture, Supabase Auth/PostgreSQL/Storage, company isolation and project ownership. Current profile/company model is a foundation, not a completed project-membership or external-client permission matrix. Future Observe → Contribute → Propose → Review → Approve → Execute → Override is an authority vocabulary, not a claim that those permissions exist today. Build explicit action/resource/project scopes, delegation, approval thresholds and audit before exposing such controls. External directory participants remain unauthenticated unless separately invited through an approved access design.

**Future acceptance:** Company B cannot read/write A originals, metadata, chunks, links, histories, signed files or derived metrics; same-company restricted projects and external/client roles are also tested; unauthorized approval and direct API/RPC/table paths fail. Revocation, account switching, role change and historical access must be defined. Shared metric definitions cannot leak restricted source data through aggregates or citations. **Dependencies:** Q02 permission matrix before portal/financial review rights.

## R02 — Reliable field evidence and verified physical progress

Maintain separate records for: a task to do; planned activity; assigned resource; reported work; actual presence; evidenced physical quantity; and approved progress. Neither a scheduled employee nor a confirmed subcontractor is necessarily onsite. Actual presence needs an explicit source and timestamp. Field log text/photo/report is reported evidence, not automatic verification.

Future workflow: field contributor captures quantities, location/scope, photos/inspection/milestone evidence and uncertainties → authorized PM/reviewer checks → accepted/rejected/needs-information result with actor/time/reason/source references → approved state informs authorized dashboards and eligible draft billing. Keep original submissions and corrections, not only the latest narrative. Define permissions, dispute/reopening, partial acceptance, duplicate evidence, reporting period and cutoff. No AI output or task completion alone certifies work.

Verification terminology must distinguish (a) transport/storage bytes, (b) extracted source text, (c) reported physical work, (d) reviewer-verified progress, (e) contractual/financial approval. Current document hash verification establishes (a), not (d) or (e).

**Future acceptance:** unauthorized verification fails; evidence cannot be silently changed under an approval; revised quantities retain prior decisions; duplicate/retried submissions do not double count; rejected or stale reports do not improve completion; Company A/B and project access preserved. Concurrent review and field correction require explicit stale/conflict handling. **Dependencies:** stable scope/location identity, Q02/Q03/Q04; reuse current report/photo/version IDs.

## R03 — Financial measures and baseline integrity

Maintain separately:

| Measure | Meaning / restriction |
| --- | --- |
| Physical completion | Approved installed/performed quantities or approved scope-weighted completion, not elapsed time |
| Elapsed time | Calendar/time measure; no automatic work-earned interpretation |
| Approved contract value | Original authorized contract plus approved changes, retaining baseline revisions |
| Verified earned contract value | Contract allocation earned under the agreed progress method; not cost or collected cash |
| Budget | Approved internal cost plan, potentially distinct from sales/contract allocations |
| Committed cost | Authorized obligations, distinct from actual posted cost |
| Actual cost | Validated cost incurred/posted under chosen accounting rules |
| Invoiced/submitted | Approved billing/request actually issued; not automatically earned or paid |
| Cash collected | Recorded payment receipt and allocation |
| Retainage / outstanding | Contractual withholding and unpaid balance under explicit definitions |

The supplied anecdote suggests scope/quote-value-weighted progress. It does not settle accounting practice, revenue recognition or a universal algorithm. A possible future calculation is Σ(approved scope allocation × verified fraction) / current approved contract allocation, but this remains subject to Q03/Q04. Define quantities/units, zero denominator, negative credits, provisional allowances, stored materials, rounding, overrun, reversals and change timing. Preserve both original and revised baseline; approved changes must not rewrite historical monthly states. Never double count subcontract, material, labor or management allocations.

**Future acceptance:** fixture calculations reconcile allocations, adjustments and prior periods; rejected/unapproved changes excluded; actual cost and cash do not change physical completion; denominator changes are explainable; every metric includes definition/version, period/as-of and provenance. Restricted prices/margins cannot be inferred by client drilldown. **Dependencies:** accounting discovery and scope baseline approval; no financial schema selected by this audit.

## R04 — Monthly billing / draft pay applications

Proposed workflow: eligible verified progress + approved changes + prior billings + retainage rules → draft monthly application → authorized review/approval → submitted/invoiced → payment allocation → paid/partially paid/outstanding. A saved report, current document or completed task cannot trigger payment or an issued invoice. Support corrections, rejected applications, credits and auditable period lock/reopening policies once defined.

Distinguish contractor-to-client billing from subcontractor payment applications and company SaaS subscription billing. No implementation or integration is claimed for any of them. Define who can prepare/approve/issue, customer contract types (fixed price/T&M/cost-plus), stored-material eligibility, taxes, retainage releases and accounting source of truth before build.

**Future acceptance:** no duplicate billing on retry; prior billed amounts reconcile; unauthorized issue/payment fails; unchanged approved application remains reproducible after later schedule/scope edits; rejected progress excluded; invoice and collected cash separately displayed. **Dependencies:** R01–R03 and Q04/Q05.

## R05 — Shared Project Health Dashboard and client workspace

One canonical project record and shared calculation definitions; tailor presentation and disclosure to superintendent, PM, executive/operations, finance and client responsibilities. Candidate measures: verified completion, budget utilization, schedule state, phase, next milestone, earned value, payment and actionable risks **only where authorized and supported by real data**. Show freshness, as-of period, preliminary/reported/verified status and missing information. An empty metric is preferable to an invented “on track” label.

“Show me the breakdown” should progressively reveal scope/trade/phase/resource and, where permitted, subcontractor/labor/material/management and source evidence. Client views omit internal margin, subcontractor pricing, labor rates, draft observations and internal discussion by default. A hidden navigation item is not protection. Define whether shared metrics can safely expose aggregates when their inputs are private.

Portal is a restricted workspace on the same authorized state, not another data silo. Future candidate functions: published timeline, gallery, shared documents, selections, change review, communications/notifications, handoff/closeout/property history. Publishing and revocation need explicit controls and audit; source promotion alone does not publish or approve.

**Future acceptance:** every role view reconciles the same permitted definitions; restricted drilldowns/downloads/search/citations deny access; client cannot manipulate internal progress or costs; unapproved material stays private; stale data visibly labelled; mobile/keyboard workflows tested. **Dependencies:** Q02/Q03/Q06; existing dashboard may be reused without claiming finance/client features are present.

## R06 — Scheduling evolution

Retain implemented project/company month/week/day calendars, stable trade identity, separate status, assignments, explicit timezones, task references, multiple predecessors, revisions and audit. Keep cancellation/history rather than losing planning evidence. Existing inactive assignments can remain unchanged for history/planning; no new or changed inactive assignment without reactivation, while removal stays possible.

Future operational chain: master schedule → 2–3-week lookahead → daily execution → evidenced actuals. Evaluate Gantt, durations, dependency types/lags, constraints, inspections/deliveries, approved baselines, float/critical path, downstream-slip visibility and controlled recalculation. A dependency graph is not a scheduling engine. Preserve original vs revised vs actual, not only event history. Explicitly choose manual proposals vs automatic propagation and approval rights; no current promise of Microsoft Project replacement.

Assignments remain planned capacity; overlaps can be legitimate. Later utilization needs resource availability/calendars/capacity and actual labor data. Task/activity/resource/performed work stay separate. Date-only milestones, local timezones, daylight-saving transitions, multi-project timezones and resource deactivation require tests.

**Future acceptance:** retain current transactional/receipt/revision/cycle/A-B tests; proposed graph calculations deterministic; simultaneous changes cannot create cycles or clobber newer assignment edits; baseline is reproducible; downstream changes visible and authorized; shared resource overlap advisory; desktop/mobile/keyboard flows and larger-company query limits tested. **Dependencies:** D01/Q07; actual labor analytics depends on R02/R08.

## R07 — Documents, provenance and connected intelligence

Retain approved immutable versions, explicit current promotion, company/project authorization, archive/restore, safe supported formats, upload/processing limits, bounded server verification, metadata/source search and exact-version links to tasks/schedule/reports. Failed/pending upload must never look successfully persisted/current. Source facts and AI interpretation remain separate; no auto approval from indexing or promotion.

Current inspected upload safeguards include a 20 MiB per-file cap, conservative 2 GiB company reservation ceiling, 50 upload registrations per actor/hour and 20 indexing requests per actor/hour. Digital-PDF extraction is bounded at 200 pages and 2 MiB UTF-8 output. These are implementation safety limits, not approved pricing tiers, guaranteed full-plan coverage or completed orphan/retention policy. Any future changes need corresponding security/capacity acceptance.

Future federation may connect SharePoint/OneDrive/Dropbox/Drive/email or firm repositories. Before build, establish external tenant/user identity, source permissions and revocation, immutable version identity, sync state/freshness, deletion/retention, conflict policy and audit. Decide reference-only vs cached managed bytes and which source is authoritative. External edits are not automatically approved construction instructions. Do not treat a connector as authorization to ingest every folder.

Later OCR/vision, structured drawing/spec relationships, revision/RFI/submittal/change impact and source reconciliation must preserve exact page/detail/version/hash and uncertainty. Licensed Construction Knowledge, jurisdiction-edition Regulatory Knowledge, private Project/Company Knowledge and authorized Property Knowledge remain distinguishable.

**Future acceptance:** current upload/retry/verification/archive/search/link/isolation gates retained; revoked source access removes unauthorized retrieval/citations/cache access; changed remote versions do not overwrite old references; unsupported/scanned files show truthful processing state; derived claims retain source and review status. **Dependencies:** Q08 licensing/integration/retention decisions; no connector or OCR implementation authorized here.

## R08 — Selective offline field operations

“Work anywhere. Synchronize when connected.” This is future selective capability, not a claim of current offline support.

First candidates: explicitly downloaded schedule/lookahead/tasks/contacts/approved documents with freshness; report/note drafts; queued photos; task/punch/deficiency observations. Subsequent candidates: actual labor/time/cost code, inspections/punch and schedule observations/proposals after underlying workflows exist. Initial online-only boundary: financial/contract approval/payments, permissions, authoritative rescheduling/CPM and other consequential actions.

Required visible states: saved on device → pending → syncing → server-confirmed; plus conflict/attention/failed. Stable operation IDs, trusted transactional receipts, revision checks, bounded retry/backoff, dependency ordering and record-specific conflict resolution. A transport acknowledgment is not persistence confirmation. Do not blindly replay approvals or last-write-win critical edits. Hash original bytes, reconcile metadata/objects, handle orphan cleanup and partial success. Define quotas/eviction and browser/PWA/background limits; users must know when local storage is unavailable or cleared.

Security design must address local encryption/key management, shared/lost devices, logout/account switching, session expiration and remote revocation. Previously cached authorized data cannot magically be recalled from an offline device; define expiry, restricted download policy and residual exposure. Avoid exposing client/private financial data offline by default. No durable queue, encryption promise or background sync guarantee exists today.

**Future acceptance:** real devices and poor connectivity, airplane mode/restart/process death/storage eviction/quota; out-of-order retry/duplicate/lost response; changed revision/removed resource/revoked project/user; queued-photo byte interruption; account switching and token expiry; readable pending/failure/recovery states; no false saved or duplicate business records. Browser emulation alone insufficient. **Dependencies:** Q09 approved offline subset/security/retention and R01/R02 receipt boundaries.

## R09 — Long-term lifecycle and knowledge

Preserve architecture opportunities: voice/vehicle-first multilingual field capture; digital measurement/identification/calculation/takeoff/estimate/price/code/translation; communications and procurement; company historical costs/productivity; change intelligence; closeout/warranty/service; Property→building→floor→room→system→component→installed product history; licensed construction/regulatory knowledge; controlled API/agents and possible physical-AI consumers.

Keep project/job and enduring place identities distinct, with source/effective/recorded dates, original evidence and reviewed relationships. A spec does not prove installed state; an old photo does not prove current condition. Handoff needs ownership/contract permissions, not automatic cross-company transfer. Class B data remains private; Class C property continuity and Class D aggregation require authorization. IFC/CSI references do not mandate graph database/BIM adoption or confer licenses.

**Future acceptance:** evidence chains, unknown/contradictory claims and chronological repairs retrievable; no tenant pooling or inaccessible citations; approved sensitive actions audited; language originals retained. Reference Project 001 is a future evaluation foundation, not live proof of these systems.

## R10 — Design and commercial learning

Use [design principles](DESIGN_PRINCIPLES.md); keep Sprint 6 tokens/patterns and responsive layouts. Clarity for different responsibilities without fictional permissions. Basic workflows remain useful without AI. Measure comprehension/effort with contractors, not decorative feature count.

Private beta and discovery precede major new feature commitments. Candidate initial cohort 3–5 contractor acquaintances, then referrals/outreach; aspirational ten paying companies by April 2027. $99–149/company/month is a pricing experiment, not settled packaging. Measure activation, repeated real-project use, time saved, role fit, support burden, willingness to pay and retention. Content bank of 20–30 ideas and brand/trademark research run in parallel; no invented traction or legal clearance.

**Future acceptance:** defined cohort consent/privacy/support/onboarding, measurable success/exit criteria and actual feedback linked to decisions. No sample-size anecdote presented as broad demand. **Dependencies:** Q01 priorities and Q10 commercial experiment.
