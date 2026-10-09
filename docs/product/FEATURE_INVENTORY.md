# Product capability inventory — 2026-10-09

[Status definitions](README.md#status-and-evidence-rules). IV means reviewed implementation and recorded development acceptance, not production approval. Sources are repository-relative links; sprint reports contain execution limits. This inventory covers the supplied vision and existing architecture at capability level, not every individual UI control.

## Current operational foundation

| ID | Capability / status | Evidence and boundary |
| --- | --- | --- |
| F01 | Authentication, company context and tenant isolation — IV | [Auth context](../../lib/auth-context.ts), [core schema](../../sql/week3_core_tables.sql), sprint isolation reports. Current profile belongs to one company; no new external access inferred. |
| F02 | Fine-grained project/role/finance/client permission matrix — PL | F01 supplies company/project ownership checks, not project-member ACLs or the future Observe→Override authority hierarchy. Role strings are not proof of differentiated enforcement. |
| F03 | Project CRUD and overview — IV | [Projects](../../lib/projects.ts), [job desk](../../lib/job-desk.ts), [Sprint 6](../SPRINT_6_VISUAL_TRANSFORMATION_2026-10-09.md). Metadata, status, tasks and operational summaries; no approved contract/SOV or physical completion model. |
| F04 | Tasks and follow-through — IV | [Tasks](../../lib/tasks.ts), [lookahead](../../lib/operational-lookahead.ts), [Sprint 2](../OPERATIONS_LOOKAHEAD_SPRINT_2026-10-07.md). Task state is not work quantity or attendance. |
| F05 | Field logs, daily reports, crew entries and photos — IV | [Core job schema](../../sql/week11_core_job_operations.sql), [Sprint 3](../FIELD_RELIABILITY_SPRINT_2026-10-07.md). User-entered records are evidence, not independently PM-certified quantities. |
| F06 | Atomic report/crew/follow-up saves, retry and stale-edit handling — IV with compatibility limits | [Original RPC](../../supabase/migrations/20261008054310_field_report_atomic_save.sql); hardened receipt path at separate [229f3af](https://github.com/torrescarroll-droid/SITEPM/commit/229f3af9d68ca6de973fa6426b608ec54245b004). Legacy direct report/crew paths remain nontransactional; not every historical write boundary is hardened. |
| F07 | Recoverable browser drafts — IV | [Report drafts](../../lib/report-draft-storage.ts), report/schedule/upload forms. Session-scoped recovery and request identity, not durable offline operation. |
| F08 | Operational dashboard / 14-day lookahead — IV | [Lookahead](../../lib/operational-lookahead.ts), [job desk](../../lib/job-desk.ts). Overdue/open tasks, schedule readiness, flagged records; task/schedule done counts are not weighted construction progress. |
| F09 | Autonomous AI daily briefing / consequential execution — PL | Original [build spec](../../SITEPM_BUILD_SPEC.md) describes direction; current record-derived desk is not evidence of autonomous execution. AI cannot authorize actions. |

## Scheduling and workforce

| ID | Capability / status | Evidence and boundary |
| --- | --- | --- |
| F10 | Project/company calendar month/week/day, navigation/filtering — IV | [Sprint 4](../CONSTRUCTION_SCHEDULING_SPRINT_2026-10-08.md), [types](../../lib/schedule-types.ts), [Sprint 6 browser record](../SPRINT_6_VISUAL_TRANSFORMATION_2026-10-09.md). Company-wide view is a scheduling view, not executive financial analytics. |
| F11 | Create/edit/reschedule/cancel, timed/all-day/multiday, milestones/status/trades — IV | [Schedule actions](../../lib/schedule-actions.ts), Sprint 4/6 reports. Stable trade colors and explicit status. Drag-and-drop is not claimed as universal/touch-supported behavior. |
| F12 | Reusable employees/subcontractors/crews/suppliers/external directory — IV | [Scheduling migration](../../supabase/migrations/20261008163441_construction_scheduling.sql). Resource records are not authenticated users or portal invitations. |
| F13 | Multiple assignments, expected crew counts and potential overlaps — IV | Sprint 4 data/actions/tests. Expected presence is not actual onsite presence; overlap is advisory, not certainty or capacity analysis. |
| F14 | Task references, multiple predecessors and lookahead integration — IV | Scheduling schema and [review reproducer](../../scripts/construction-scheduling-review.mjs). Links preserve task/activity separation; graph edges do not implement CPM. |
| F15 | Revision/receipt/cycle/resource integrity, history — IV | [Hardening migration](../../supabase/migrations/20261008201434_scheduling_integrity_boundary.sql), [hardening evidence](../SPRINT_4_INTEGRITY_HARDENING_2026-10-08.md). Restricted transactional boundary, serialized graph checks, stale rejection; unchanged inactive assignments retained, new/changed inactive assignments rejected. |
| F16 | Gantt/master schedule, dependency types/lags and downstream recalculation — PL; exact product shape EX | Stable IDs/edges/dates/history are useful foundations; no Gantt, duration engine, FS/SS/FF/SF/lag model or automatic propagation verified. Discovery D01 needs validation. |
| F17 | Formal schedule baselines, actual dates, float/CPM/variance/forecast — PL | Historical revisions are not a formal approved baseline or actual-performance model. New structured semantics and algorithms required; no predictive claims. |
| F18 | Resource capacity/utilization/labor forecasting — PL | Assignments exist; capacity calendars, actual time and cost-code relationships do not. |
| F19 | Master→2–3-week lookahead→daily execution — P | Current 14-day view and daily calendar exist. Integrated master planning and configurable 3-week horizon remain future. |
| F20 | Timeclock, actual attendance, labor hours/cost codes — PL | Crew/report inputs are not verified presence, payroll or measured timesheets. Explicit event source/timestamp and approvals required. |

## Documents and intelligence

| ID | Capability / status | Evidence and boundary |
| --- | --- | --- |
| F21 | Private project documents, organization and metadata search — IV | [Sprint 5 implementation](../DOCUMENTS_PROJECT_INTELLIGENCE_SPRINT_2026-10-09.md), [management](../../lib/document-management.ts). No federation or deep folder tree claimed. |
| F22 | Immutable versions, explicit current promotion, archive/restore — IV | [Migration](../../supabase/migrations/20261009010546_document_management.sql), [browser acceptance](../SPRINT_5_BROWSER_ACCEPTANCE_2026-10-09.md). Promotion is current selection, not approved-for-construction status. |
| F23 | PDF/JPG/PNG/DOCX/XLSX/PPTX uploads, safeguards and trusted byte verification — IV with format-specific coverage limits | Sprint 5 format/security tests; browser flow primarily PDF. No general Office preview, legacy DOC/XLS/PPT support or antivirus guarantee. Size/quota/processing limits live in implementation, not invented commercial tiers. |
| F24 | Interrupted upload/retry/TUS recovery and saved confirmation — IV | [Browser evidence](../SPRINT_5_BROWSER_ACCEPTANCE_2026-10-09.md), [transport](../../lib/document-upload-transport.ts). Browser reload during verification plus separate multi-chunk byte-resume tests; not a physical cellular-disconnect test. |
| F25 | Exact-version task/schedule/report links — IV | Sprint 5 schema/browser evidence. Promotion does not silently rewrite old references. |
| F26 | Bounded digital-PDF extraction, chunk retrieval and Ask source citations — IV | [PDF extraction](../../lib/pdf-text-extract.ts), [chunk retrieval](../../lib/document-chunk-retrieval.ts), [Ask](../../lib/ask-actions.ts), Stage 4 tests and Sprint 5 acceptance. Text/PDF source provenance; no scanned-plan OCR/vision implied. |
| F27 | Grounded project Ask, replaceable model and evidence labels — IV | [Grounding](../../lib/ask-grounding.ts), [retrieval](../../lib/ask-retrieval.ts), Ask suites. Answers are not approval or guaranteed correctness. |
| F28 | OCR, drawing understanding, structured component extraction, revision comparison — PL | Architecture §§21/28; reference fixtures are not implemented runtime capability. |
| F29 | RFI/submittal/change-order workflows and approved-for-construction control — PL | Uploaded category/source documents do not implement review/approval lifecycle, distribution or contract change management. |
| F30 | SharePoint/OneDrive/Dropbox/Drive/email federation — EX | Discovery D02; no connectors, sync permissions, external version identities or revocation behavior implemented. |
| F31 | General construction / regulatory knowledge — PL; acquisition EX | [Source registry](../DATA_SOURCE_REGISTRY.md). No corpora/license acquisition verified. California-deep then national; jurisdiction/edition/provenance mandatory. |
| F32 | Reference Project 001 lifecycle benchmark — IV as static fixture only | [Fixture guide](../reference-projects/001/README.md). Fifteen fictional Markdown sources/evaluator; not live property schema, PDF/image acceptance or customer evidence. |

## Verified progress, finance and shared project health

| ID | Capability / status | Evidence and boundary |
| --- | --- | --- |
| F33 | Reported→reviewed/verified physical progress with evidence/quantities — PL | Addendum §1; no scope-line approval, quantity certification or PM verification workflow in inspected tables/routes. Existing field evidence is a foundation only. |
| F34 | Approved scope/SOV, weights and contract baseline revisions — PL | Addendum §1. No SOV/contract-value ledger schema. Detailed methods require owner/customer/accounting decisions. |
| F35 | Financial budget/actual/committed/earned-value tracking — PL | Addendum §1 and architecture §§10/29. Distinct measures; schedule/task counts cannot substitute. |
| F36 | Monthly draft pay applications, retainage/prior billings/payment status — PL | Addendum §1. No monthly billing, approval, invoice, payment or collection implementation. |
| F37 | Accounting integrations — EX | D03 mentions Sage 100 and “Buildermaster” secondhand; spelling/product/API/rights unconfirmed. No supported connector commitment. |
| F38 | Shared project health with PM/executive/finance/client views — P | Existing dashboard/overview F03/F08 is operational; shared verified financial metrics, versions, freshness and differentiated access remain PL. |
| F39 | Client portal / approved external project workspace — PL | Architecture §9/addendum §2. No client identity, project membership, publish control or financial disclosure boundary verified. |
| F40 | Client selections, changes, communications, gallery/timeline/closeout — PL | Portal direction; existing internal photos/docs do not grant client visibility. |

## Offline, interaction and long-lived intelligence

| ID | Capability / status | Evidence and boundary |
| --- | --- | --- |
| F41 | Selective offline read packs and durable field-write queue — PL | Session drafts/TUS are partial foundations, not full offline. No service worker/IndexedDB queue found in inspected app/components/lib. |
| F42 | Offline labor/punch/inspection/schedule proposals — PL | Conditional on underlying workflows; authoritative schedule/financial/permission changes initially online-only. |
| F43 | Sprint 6 reusable visual system and responsive existing screens — IV | [Visual system](../LINEHORSE_VISUAL_SYSTEM.md), [screenshots](../SPRINT_6_VISUAL_TRANSFORMATION_2026-10-09.md#visual-evidence). Browser emulation, not physical-device/accessibility certification. |
| F44 | Clarity at Every Level / role-sensitive progressive disclosure — P | Shared visual patterns exist; future role-specific health/billing/portal surfaces need design and actual permissions. Three-second clarity is a design test, not measured claim. |
| F45 | Final horse logo / trademark clearance — EX/U | Current wordmark/system retained. Right-facing profile preference exploratory; mockup/front-facing mark is not approved asset. No clearance established. |
| F46 | Voice/vehicle-first capture and multilingual expertise bridge — PL | Architecture §§6/7/13/24/27. No voice OS, full bilingual engine or hands-free safety certification. |
| F47 | Field-to-Office structured intelligence / two-way Jobsite Copilot — PL | Field report foundations exist; automatic source-preserving interpretation/proposals/approval pipeline does not. |
| F48 | Digital Toolbag: ask/measure/identify/calculate/takeoff/estimate/price/code/translate/document/communicate/schedule/order/diagnose/research/service — P | Ask/document/schedule subsets exist. Remaining tools are opportunity map, not shipped modules. |
| F49 | Estimating/takeoff/procurement/PO/inventory/equipment operations — PL | Architecture domains and build-spec future scope. Calendar equipment activity type is not equipment inventory/maintenance. |
| F50 | Company historical memory/productivity/vendor performance/estimate-vs-actual — PL | Historical records retained; validated outcome metrics and learning loop not implemented. Tenant private by default. |
| F51 | Living Property Record, rooms/systems/components/installed products — PL | Architecture §20. Project address is not stable property identity. Effective dates, evidence, repair history and authorized handoff required. |
| F52 | Closeout/warranty/service/remodel lifecycle — PL | Retained docs are partial evidence foundation; no authorized ownership transfer, service workflow or installed-product ledger. |
| F53 | Controlled ingest/agent API and consequential action governance — PL | Architecture §§12/31/32. Existing server actions/RPCs are not a general third-party agent permission platform. |
| F54 | Relational Construction Graph / optional IFC/CSI mappings — P / EX | Operational relational FKs exist. Broader job/place graph PL; external mappings license-gated EX; no graph database adoption. |
| F55 | Physical AI/sensors/robotics environmental memory — EX | Architecture §33; no robotics implementation or commitment to hardware. |
| F56 | Knowledge/privacy classes A/B/C/D — P as policy foundation | Existing tenant-private B isolation implemented; licensed A corpora, authorized C lifecycle and governed D aggregation not implemented/authorized. |

## Additional retained operational domains

| ID | Capability / status | Evidence and boundary |
| --- | --- | --- |
| F63 | Client communications, weekly reports, notifications and front-office intake — PL | Handoff §3 and architecture communications/domain map. Internal field reports and Ask are not outbound client reporting, a shared inbox or approved messaging execution. |
| F64 | Compliance/permits and detailed inspection/punch workflows — PL | Handoff §3 and offline candidates. Scheduling an inspection or flagging a log is not regulatory compliance, permit tracking or a full punch-review workflow. |
| F65 | Design/photo concepts, digital measurements and construction calculators — PL / EX | Handoff §3 and Toolbag architecture. No generated design concept, takeoff accuracy or measurement capability is claimed from uploaded images/reference mockups. |
| F66 | Business/growth/office/people organizational workspaces — P | Canonical OS domain map retained. Existing operational shell/resources cover a subset; CRM/acquisition, HR/certifications, organization-level workflows and specialized estimator/finance workspaces remain future. |

## Business and release

| ID | Capability / status | Evidence and boundary |
| --- | --- | --- |
| F57 | Private contractor beta — PL | [Beta guide](../PRIVATE_BETA_GUIDE.md), handoff §9. Recruitment is not evidence of active/paying users. |
| F58 | Ten paying companies / April 2027 aspiration — PL target | Handoff; not revenue forecast, achieved traction or shipping deadline. |
| F59 | $99–149/company/month pricing and packaging — EX | Discovery experiment, not approved pricing, entitlement model or billing system. Depth levels are not pricing tiers. |
| F60 | Content bank/outreach/customer-learning program — PL | 20–30 content ideas across trades/history/field insights/building LINEHORSE/learning library. Parallel business work, not engineering authorization. |
| F61 | Production backup/recovery and staged release — U | DB plus Storage-byte restore must actually succeed in isolation; schema/ACL/configuration/maintenance/rollback gates remain. Historical deployment reported Sprint 2; no production checked by this audit. |
| F62 | Historical Stage-3-only/PDF-not-started and browser-pending descriptions — S | Retained for chronology; later Stage 4/Sprint 5 evidence supersedes implementation status. |
