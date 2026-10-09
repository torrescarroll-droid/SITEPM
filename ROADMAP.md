# LINEHORSE product roadmap

> Current audited status: see [2026-10-09 knowledge-audit update](#2026-10-09--product-knowledge-audit-current-status-and-proposed-horizons). Earlier milestone rows are retained historical snapshots; the dated update resolves stale SHAs and acceptance status.

Aligned with [PRODUCT_VISION.md](PRODUCT_VISION.md) and the canonical [product architecture](docs/PRODUCT_ARCHITECTURE.md). Implementation state and release state are separate.

| Milestone | State | Operational outcome |
| --- | --- | --- |
| Week 11 / Sprint 2 core operations and lookahead | Production baseline `12a0615` | Projects, tasks, field records, operational follow-ups, 14-day lookahead |
| Sprint 3 field-data reliability | Implemented, PR #3 at `44e5bda`; not released | Atomic report/crew saves, recovery, idempotency, isolated write acceptance |
| Sprint 4 construction scheduling and workforce coordination | Implemented on a branch stacked on Sprint 3; integrity defects resolved in isolated acceptance; ready for engineering review with production release prerequisites | Functional month/week/day project and company calendars, reusable resource directory, assignments, status, history, transactional saves |
| Sprint 5 Documents & Project Intelligence | Implemented in a branch stacked on Sprint 4; release and complete browser acceptance pending | Recoverable verified uploads, immutable versions/current promotion, project organization, archive/restore, metadata/PDF retrieval and exact-version work references |
| Next scheduling milestone | Planned | Contractor pilot feedback, larger-calendar query/windowing, resource capacity and dependency editing usability; validate actual-vs-planned evidence links before analytics |
| Gantt and schedule analytics | Planned, not implemented | Dependency graph UI, explicit baselines/actuals, schedule variance, critical path, forecasting, labor/cost-code integration after data and customer validation |

Sprint 4 implements the previously requested scheduling UI direction. Trade colors stay stable; status uses separate text. No schedule reference image was found in the inspected project materials. Functional inspiration comes from publicly documented construction scheduling workflows, with original LINEHORSE UI and code. See [Sprint 4 implementation and acceptance](docs/CONSTRUCTION_SCHEDULING_SPRINT_2026-10-08.md).

Release order: verify production backup/recovery, authorize and release Sprint 3, review/authorize Sprint 4 migration and application release. Neither sprint is authorized for production changes by the Sprint 4 assignment. Do not infer deployment from an implementation milestone.

Parallel business workstreams remain customer discovery, private beta recruitment, pricing/monetization validation, and marketing toward 10 paying contractors. These are business priorities, not extra Sprint 4 engineering deliverables.

## Sprint 5 authorization and release boundary — 2026-10-09

The approved [document milestone](docs/SPRINT_5_DOCUMENTS_PROJECT_INTELLIGENCE_PLAN_2026-10-08.md) extends the existing private project-document and PDF extraction foundation. Basic retrieval and uploads do not depend on AI or text extraction. Files are evidence; promotion does not approve construction instructions. See [implementation, acceptance and release prerequisites](docs/DOCUMENTS_PROJECT_INTELLIGENCE_SPRINT_2026-10-09.md).

Ordered releases remain Sprint 3 → Sprint 4 → Sprint 5. Sprint 5 targets the Sprint 4 development branch for an isolated review diff; retarget to main only after earlier releases and ancestry review. Backup/recovery must include Storage bytes as well as the database. No production release is authorized by development approval.

Next recommended engineering milestone: contractor pilot hardening of document retrieval and schedule-to-field evidence, with completion of the outstanding browser gate first. OCR/drawing interpretation, revision comparison, RFI/submittal approvals, external access, deep folder trees, offline synchronization, Gantt/critical path and predictive/labor analytics remain planned. Customer discovery, beta recruitment, pricing and marketing toward 10 paying contractors continue in parallel.

## Sprint 6 visual direction — 2026-10-09

Sprint 5's browser gate subsequently passed at `5f3403a`, ready with documented release conditions. Sprint 6 stacks on that validated baseline and applies the user-supplied LINEHORSE visual reference to existing functionality: dark navigation, copper accents, warm surfaces, legible dense workspaces and responsive reusable patterns. It does not redesign product architecture or add mockup-only modules. See [visual system](docs/LINEHORSE_VISUAL_SYSTEM.md) and [implementation/acceptance](docs/SPRINT_6_VISUAL_TRANSFORMATION_2026-10-09.md).

Release order now extends Sprint 3 → Sprint 4 → Sprint 5 → Sprint 6; production backup/recovery and explicit release authorization remain required. Customer discovery, beta recruitment, pricing and marketing remain parallel business workstreams. Contractor pilot usability review is the recommended next design milestone.


## 2026-10-09 — Product knowledge audit: current status and proposed horizons

[Permanent product record](docs/product/README.md), [capability inventory](docs/product/FEATURE_INVENTORY.md), [requirements](docs/product/PRODUCT_REQUIREMENTS.md) and [decisions/discovery](docs/product/DECISIONS_AND_DISCOVERY.md) preserve the full vision. This update does not authorize implementation or release.

### Current release candidates

GitHub PR metadata read on 2026-10-09; all four are open and unmerged. Deployment state was not queried. Historical production baseline remains reported Sprint 2 `12a0615`, not a fresh production assertion.

| Sprint / PR | Exact head | Current state / dependency |
| --- | --- | --- |
| 3 / #3 | `229f3af9d68ca6de973fa6426b608ec54245b004` | Not draft. Receipt false-success defect fixed and tested in isolation; supersedes `44e5bda` as release head. Original atomic migration followed by receipt-hardening migration required. |
| 4 / #4 | `870f9a269934e03bc3f7abdc6775bc679b72b6ee` | Not draft. Four scheduling integrity fixes verified in isolated acceptance. Stacked on original Sprint 3 `44e5bda`; reconcile new Sprint 3 ancestry and retest actual candidate before release. |
| 5 / #5 | `5f3403a65ef4fd3090684682d8e65c5819c30b37` | Draft. Desktop/emulated-mobile document acceptance completed; original browser-pending row is historical. Stacked on Sprint 4. |
| 6 / #6 | `61fd8fcc49046aea77601100905daa0ec72abe42` | Draft. Visual/refinement gates recorded passed; no new migration. Stacked on Sprint 5. |

Order remains **Sprint 3 → Sprint 4 → Sprint 5 → Sprint 6**. Receipt fix was tested as an overlay against the Sprint 6 tree; that is not a merged ancestry or fresh verification of a future merge candidate. Use an explicit reviewed migration allowlist: original Sprint 3 → receipt follow-up → both Sprint 4 migrations → Sprint 5 migration. Do not blindly sort filenames or push all migrations. Legacy application schedule/document writes become incompatible with new boundaries; maintain the reviewed write pauses and matching application cutovers.

Production **NO-GO** until DB and Storage backup integrity and an actual protected isolated restore pass, correct project/schema/ACL preflight, restricted writer/verifier configuration, enforceable write pause, Railway configuration/build/rollback checks, draft/release reviews and explicit authorization. Do not re-enable vulnerable grants or destructively restore as an automatic rollback.

### Proposed horizons, not newly authorized sprints

| Horizon | Outcome | Entry/exit evidence |
| --- | --- | --- |
| H0 — Finish safe release readiness | Protected recovery, ordered reviews/cutover, production-safe operational baseline | Release gates above; actual isolated DB+Storage restore, no assumed verification |
| H1 — Private beta / pilot hardening | 3–5 candidate contractors test real workflows and Sprint 6 clarity; resolve reliability/usability gaps | Consent/privacy/support, activation/use/time saved/retention evidence and physical-device/jobsite testing; participant count not yet achieved |
| H2 — Verified progress foundation | Field evidence → PM review → traceable approved scope/quantity progress | Owner decisions Q02/Q03; approved definitions, audit, stale/isolation/rejection tests; no automatic financial approval |
| H3 — Shared health / financial and client views | Authorized views of common definitions; eligible draft monthly billing and explicit client publication | Q04–Q06, contract/SOV baseline, separate cost/earned/billed/cash/retainage, accounting reconciliation and disclosure tests |
| Parallel candidate — Selective offline field operations | Downloaded read packs and safe queued field evidence with truthful sync states | Q09; device/security policy, durable identity/retry/conflict/byte tests and real poor-connectivity testing |
| Parallel candidate — Master scheduling | Gantt/master→2–3-week lookahead→daily execution, controlled downstream changes | D01/Q07 validation; dependency/calendar/baseline semantics before CPM/forecasting claims |
| Research — Federation and integrations | Connect authorized external documents/accounting sources without duplicating truth | Confirm D02/D03 vendors/access/rights; Q05/Q08; revocation/version/source-of-truth tests |
| Long-term — Construction/property intelligence | Voice/bilingual Toolbag, historical costs, procurement, changes, closeout/service, property memory, licensed knowledge and controlled agents | Explicit milestones; retain canonical architecture, A/B/C/D privacy, provenance and licensing gates |

Ordering H2/H3 is a recommended dependency chain, not a commitment to start them before validated beta learning. Offline/master scheduling prioritization requires owner input Q01. No feature idea is dropped because it is outside the next sprint.

Parallel business work: customer discovery, recruitment/referrals, pricing experiment (not approved public prices), 20–30-item content bank, trademark/brand research. Ten paying companies by April 2027 is an aspiration, not a forecast or existing traction.
