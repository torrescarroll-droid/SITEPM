# LINEHORSE / SITEPM — Product Vision, Decisions & Roadmap Handoff

**Prepared:** 2026-10-09  
**Purpose:** Durable, version-controlled record of product decisions and ideas discussed through October 9, 2026, for Cursor to reconcile with the repository.  
**Status:** Product-direction handoff, **not** implementation authorization, release approval, or a claim that every feature exists.  
**Brand:** LINEHORSE (preferred; professional trademark clearance not yet confirmed). **SITEPM** is the construction software/platform project.

## 1. North star — established decisions

- **Category:** Construction Intelligence platform; AI is a replaceable enabling technology, not the product identity or durable moat.
- **Mission:** “Capture construction reality once. Turn it into useful intelligence everywhere. Preserve it for the life of the property.”
- **Founder/product principle:** **“BUILT FOR BUILDERS, BY BUILDERS.”**
- **Brand line:** **“LINEHORSE — KEEP YOUR PROJECT RUNNING.”**
- **Durable advantage:** Permissioned, structured project/property state; provenance and evidence; integrated workflows; history; connections to external systems; APIs.
- **Product objective:** A useful operational system for real builders, spanning smaller contractors through complex multi-project construction organizations. Build trustworthy, useful workflows rather than feature theater.

## 2. One platform, many roles — established architecture principle

The “superintendent command center” describes **one workspace**, not the entire product. LINEHORSE supports different views and responsibilities for company owners/executives, operations leadership, project managers, superintendents, foremen, field workers, estimators/preconstruction, office/finance staff, subcontractors, and clients/owners as capabilities mature.

- **Separate identity, authorization, and workspace personalization.** Never treat hidden UI controls as security.
- Users may hold multiple responsibilities, and access may differ by company, project, record, and action.
- Shared project truth; role-appropriate navigation, dashboards, and actions.
- **Authority progression:** Observe → Contribute → Propose → Review → Approve → Execute → Override. This is a product governance model; do not assume every level is implemented.
- Maintain Supabase Auth/RLS tenant isolation and server/database enforcement. Any expanded permission model requires its own design, migrations, tests, and approval.

## 3. Core operational domains — product direction

**Built or underway, subject to repo verification:** authentication, companies/projects, tasks, field reports, scheduling, document management, project-aware Ask/intelligence, and LINEHORSE visual system. See section 8 for precise release status.

**Longer-term opportunities, not current commitments:** labor/time tracking with cost codes; financials, payments and project economics; change orders/contracts; client communications and weekly reports; compliance/permits; resource utilization; preconstruction/estimating; design/photo concepts and takeoffs; construction calculators; closeout/warranty intelligence; Living Property Record (installed products, locations, plans, serial numbers, manuals, repairs, warranty history, responsible trades); front-office intake/communications; integration APIs.

All AI answers should distinguish sourced observations from inference and include provenance/evidence. Never imply a record was approved, verified, saved to server, or current without proof.

## 4. Scheduling — important new field discovery, 2026-10-09

**Source:** A coworker managing larger construction projects reported that Buildertrend works well for smaller jobs, but that they prefer Microsoft's platform/tools for larger, complex scheduling. Specific Microsoft product(s) **not yet identified**. This is **one qualitative customer-discovery signal**, not an independently validated general limitation of Buildertrend.

**Pain:** Coordinating many subcontractors whose activities have predecessor/successor relationships; when one trade slips, downstream trades cannot start. Coworker values **Gantt charts**, dependency scheduling, and what appears to be **Critical Path Method (CPM)**.

**Product direction:** Connect three layers: **Master Schedule → 2–3 Week Lookahead → Daily Field Execution**. Support activity durations, predecessor/successor links, milestones, inspections, deliveries, crews/trades, constraints, and eventual CPM/float/critical path and impact analysis. A field update should help PMs see affected trades, downstream dates, and completion risk; executives should see appropriate portfolio impacts.

**Engineering boundary:** Sprint 4 has a scheduling/dependency foundation, including integrity hardening. **Do not claim a complete CPM engine, Gantt engine, or automatic recalculation already exists** without code-level verification. Model dependencies and scheduling permissions carefully; scheduling writes have compatibility constraints during the pending release.

**Follow-up research:** Ask coworker which Microsoft tool(s), what fails in Buildertrend, whether downstream schedules recalculate automatically, how baselines/float/constraints are managed, and whether changes require manual intervention. Validate with more contractors before reprioritizing.

**Priority:** Future scheduling enhancement, **not Sprint 6 scope** and not a prerequisite for initial private beta unless user testing demonstrates otherwise.

## 5. Document federation / connected project intelligence — discovery hypothesis

Another pain point raised: architects, designers, engineers, and trades retain documents in different systems (e.g., Microsoft SharePoint/OneDrive, Dropbox, Google Drive, email, firm-specific repositories). Re-uploading copies into a GC's system causes duplicate effort, stale drawings, version ambiguity, and uncertain approval status.

**Long-term direction:** Support both LINEHORSE-managed documents **and** authorized references/synchronization to external source systems. Preserve external source identity, access scope, revision/version metadata, sync state, approvals, links to schedule/tasks/field records, and an audit trail. Alert appropriate people when revisions affect work, but do not assume a detected change is approved for construction.

**Boundary:** Sprint 5 implements an internal versioned document foundation. External integrations/federation are **future discovery/roadmap**, not currently shipped.

## 6. Offline Field Operations — selected workflows, not whole-app offline

**Established direction:** “Work anywhere. Synchronize when connected.” Connectivity on jobsites is unreliable. Offline support should target field-critical operations, **not** indiscriminately replicate every module.

### Candidate offline-capable functions — prioritize by field necessity

**First wave (candidate, validate with field users):**
- Read **explicitly downloaded/cached** project schedule/lookahead, assigned tasks, essential contacts, and approved drawings/documents, with clear freshness/version labels.
- Create/edit **field-report drafts** and jobsite notes.
- Capture and queue **photos** and associated metadata.
- Record **task progress**, punch-list/deficiency observations, and basic field updates.

**Second wave (when corresponding modules exist and are validated):**
- Labor/time entries and cost codes.
- More detailed punch-list and inspection workflows.
- Limited schedule observations/proposals (e.g., “trade delayed”), **not** unreviewed authoritative rescheduling.

**Initially online-only / higher authority:** Financial approvals and payments, permissions and access changes, authoritative scheduling/CPM recalculation, contract approvals, and operations where stale data or conflicting edits create unacceptable risk.

### Non-negotiable sync semantics

- Distinguish **Saved on device → Pending sync → Syncing → Confirmed by server** and **Conflict / Needs attention / Failed**. Never show an offline draft as a server-committed success.
- Durable local queue with stable client operation IDs, server-side idempotency/receipts, version checks, and safe retries. No silent overwrites; define per-record conflict resolution and review workflows.
- Upload bytes and metadata with integrity checks; handle intermittent transfer, resumable upload where appropriate, and orphan cleanup.
- Restrict cached data by permissions; protect sensitive local data; define retention, logout/account-switch purge, device loss, revoked access, and offline expiry policies.
- Explicit offline availability and last-synced indicators; clearly mark outdated drawings/schedules; do not imply offline data is current.
- Plan for browser/PWA limitations, device storage quotas, cellular interruption, multi-device conflicts, and tests on real phones in poor connectivity.

**Status:** Future roadmap. **Do not start implementation now.** Keep architecture extensible without introducing premature offline complexity.

## 7. Visual identity — preserve and refine, not freeze

**Sprint 6 design baseline:** premium construction operations software, charcoal/midnight-blue shell, copper/amber accents, warm neutral working surfaces, refined typography, readable high-density information, strong page hierarchy, polished scheduling/cards/tables/forms, selective architectural photography in suitable headers. Avoid generic SaaS styling, repetitive images, decorative watermarks, excessive gradients, and Western/rustic aesthetics. Design for different roles, desktop, and mobile.

- Current Sprint 6 implementation is a **recoverable Git checkpoint**; capture screenshots and design tokens as a versioned visual baseline. This **does not** prevent usability and visual refinements before beta.
- **Logo:** Preferred **provisional** mark is a bold, minimal **horse-head profile** contained within a copper circular border, dark charcoal ground, with short groomed mane tight to top of neck. A forward-facing variant was also explored. The logo is **not final** and was intentionally excluded from Sprint 6 production UI. Preserve reference assets separately and evaluate at actual app-icon sizes. Do not automatically replace branding.
- Visual direction and actual screen functionality must be reconciled; do not sacrifice accessibility, speed, or usability for fidelity to a mockup.

## 8. Engineering and release truth — as reported 2026-10-09

| Stage | State | Published head / note |
|---|---|---|
| Sprints 1–2 | Deployed production foundation | Railway `main` reported at `12a0615a73f95745173173b6e5661b74e556e16f` (re-verify before action) |
| Sprint 3 — field reliability | PR #3 published, not released | `44e5bda04049736e567826b3793ba81025fe6763` |
| Sprint 4 — scheduling | PR #4 published, not released | `870f9a269934e03bc3f7abdc6775bc679b72b6ee` |
| Sprint 5 — documents | Draft PR #5 published, not released | `5f3403a65ef4fd3090684682d8e65c5819c30b37` |
| Sprint 6 — visual | Draft PR #6 published, not released | `61fd8fcc49046aea77601100905daa0ec72abe42` |

**Latest release gate: NO-GO.** Required before merging/deploying:
1. Investigate/reproduce and, if confirmed, fix **Sprint 3 client-writable save-receipt integrity** finding; regression test false success, legitimate retry, concurrency, A/B isolation, compatibility. Cursor was already assigned this investigation; **do not interrupt or duplicate**.
2. Verified encrypted **production DB and Storage object-byte** backups, with **successful isolated restores and reconciliation**; Supabase Free does not supply an adequate substitute by default. Restricted extractor credentials do not provide a complete backup. No credentials/secrets in chat, repo, or logs.
3. Verified maintenance/write pause for incompatible Sprint 4/5 legacy writes and controlled transition.
4. Production schema/ACL, Railway environment, autodeploy and rollback preflight; isolated migration rehearsal; reviews; explicit authorization.
5. Release **Sprint 3 → 4 → 5 → 6** in order. No production access, migrations, merge, or deploy until gates pass.

Existing commissioning documents, release plan, and uncommitted `PROGRESS.md` edits must be preserved. Reported automated checks and browser tests are not substitutes for physical-device/cellular testing.

## 9. Beta and commercial strategy — targets, not forecasts

- Near-term focus: trustworthy, usable private beta before starting major additional feature sprints.
- First cohort hypothesis: **3–5** contractor acquaintances using real project workflows, after security/recovery and release readiness; then expand via referrals and targeted outreach.
- Validate ease of onboarding, recurring real usage, time saved, role fit, support burden, willingness to pay, and retention. Do not equate signups or praise with adoption.
- First commercial milestone: **10 paying construction companies**, aspirational target **April 2027**, contingent on product readiness and customer validation.
- Founding-customer pricing **$99–149/company/month** is an experiment, not an approved price list or revenue forecast.
- Continue pre-launch content bank (~20–30 pieces) across trade/history, field insights, building LINEHORSE, and learning-library pillars; do not allow marketing to misstate implemented features.

## 10. How Cursor should incorporate this handoff

**This is a documentation task only. No new code or releases authorized.**

1. Inspect existing `PRODUCT_VISION.md`, `ROADMAP.md`, `PROGRESS.md`, design documentation, PRs and architecture notes **before editing**. Do not assume this handoff supersedes newer verified repository evidence.
2. Create/update an appropriate durable product-decision document (e.g., `docs/product/PRODUCT_DECISIONS_AND_DISCOVERY.md`) and cross-link from existing roadmap/vision. Preserve canonical existing documents; do not overwrite or silently reconcile disagreements.
3. Separate **LOCKED PRINCIPLES**, **VALIDATED IMPLEMENTATION**, **CUSTOMER DISCOVERY (single anecdote)**, **ROADMAP HYPOTHESES**, and **OPEN QUESTIONS**. Track dates and source/provenance.
4. Explicitly record selective offline functionality, scheduling/CPM coworker feedback, external document federation, multi-role authorization, visual baseline/logo status, and beta/release priorities.
5. Keep release readiness/production blockers visible and accurate. Record that Sprint 3 receipt integrity investigation is already underway; do not begin competing work.
6. Preserve all uncommitted files and existing branches. If working tree conflicts or current Cursor task would be disrupted, **prepare a non-destructive proposed documentation diff and wait** rather than overwrite or cherry-pick.
7. Make no application code, schema, RLS, secrets, deployment, production, merge, or environment changes. No new feature implementation.
8. When documentation is complete, report exact files, any contradictions with repo truth, and a concise decision log. **Do not commit/push until the current investigation is finished and owner authorizes a clean documentation update**, unless the owner explicitly directs otherwise.

## 11. Outstanding questions / validation backlog

- Which Microsoft scheduling product(s) does coworker actually use? What specific workflows outperform Buildertrend?
- How much CPM, baselines, float, and automatic downstream recalculation is needed by first target segment?
- Which external document repositories are actually used by early customers? Which integration yields measurable value?
- Which offline field actions are essential versus nice-to-have? What are the practical data retention and device security requirements?
- Which roles and project permission levels are needed by the first five contractors?
- What must be improved in Sprint 6 UI after hands-on owner testing, without changing its established design language?
- Can backup/restore, write pause, migration preflight, and real-device testing be verified before any production rollout?

**Operating principle:** Capture new decisions in versioned product documentation with status, rationale, and provenance. **Conversation memory is not the system of record.**
