# LINEHORSE / SITEPM — Product Knowledge Audit Addendum

**Date:** 2026-10-09  
**Companion document:** `LINEHORSE_PRODUCT_VISION_ROADMAP_HANDOFF_2026-10-09.md`  
**Purpose:** Supply later discoveries and corrected engineering status to a repository-wide reconciliation. This is a record of user-discussed product direction, **not** evidence of implemented features or permission to implement/deploy.

## 1. Verified project progress and financial intelligence

**Discovery source:** Construction colleague conversation relayed by founder, 2026-10-09. The colleague described Sage 100 and “Buildermaster” (product name/spelling requires confirmation), plus spreadsheets and fragmented project-management systems. PMs repeatedly re-enter and reconcile information, while clients ask where their project stands.

**Desired pipeline:** Field input → PM review/verification → executive operational/financial oversight → client-authorized project view. Capture once; use across roles. No duplicate entry merely to feed dashboards.

**Progress basis:** Colleague reports using the **original quote** and percentages of actual work completed to establish overall completion, with **monthly payment requests**. Preserve this as a discovery, not a universal construction accounting rule. Future approved change orders revise the contract baseline. Detailed measurement/verification and billing conventions require validation.

**Future calculation model:** An approved estimate/contract breakdown or schedule of values with weighted scope values; measured/verified physical completion for each scope; weighted aggregate completion and corresponding earned contract value. Keep distinct: physical completion, elapsed schedule time, earned value, actual cost incurred, committed cost, approved budget, amount invoiced, monthly payment application, cash collected, retainage, and outstanding balance. Do not equate these metrics or automatically approve a payment based on a field update. Guard against double counting between trade scopes, materials, labor, subs and management.

**Provenance and authority:** Field observations are reported, not automatically approved. PM or authorized reviewer verifies progress with photos, inspection records, quantities, milestones, etc. Maintain audit history and traceability of client-visible numbers. Existing authority model remains Observe → Contribute → Propose → Review → Approve → Execute → Override; do not assume this workflow is fully implemented.

## 2. Shared Project Health Dashboard and client portal

**Product direction:** One canonical project record and consistent calculations; role-specific views for PMs, superintendents, executives, office/finance staff, and clients. Client portal is a permission-restricted workspace within the same platform, **not** a disconnected duplicate product.

**At-a-glance display:** Construction completion %, budget utilization %, schedule status, current phase, next milestone, verified earned value, payment/billing status, and current project risks where appropriate. Explicitly label freshness, verification and whether values are preliminary. Do not invent an “on track” indicator without a defined metric.

**Progressive disclosure:** Simple top-level status cards/progress bars and judicious donut, bar and line charts; “Show me the breakdown” opens approved scope/trade/phase details, subs, labor, materials, management, photos, documents, change orders, and underlying verification records. The client should be able to answer “Where is my project at?” without asking the PM; the PM should see the same verified figures and deeper operational detail. Client visibility must never expose confidential internal margins, subcontract prices, labor rates, draft field observations or internal discussions by default.

**Monthly billing concept:** Prepare a reviewable draft payment application from verified eligible progress, approved contract changes, previous billings and retainage; separate draft, approved, submitted/invoiced, paid and outstanding states. Exact accounting integrations, billing conventions and permissions require discovery.

**Potential longer-term client portal:** milestone timeline, progress gallery, shared documents, selections/approvals, change orders, communications, notifications, closeout and homeowner Living Property Record.

**Status:** Established product direction and customer-discovery hypothesis; **not a claim that a financial calculation engine, client portal or payment application workflow is built**. Phase according to validation and dependencies.

## 3. Design doctrine — Clarity at Every Level

**Guiding principle:** “Power underneath. Clarity on the surface.” Sophisticated capabilities should not create visual noise. Clean, premium, restrained information architecture, clear percentages and graphs, useful charts rather than decorative ones, progressive disclosure, and immediate recognition of the most important next action/status.

**Role-specific simplicity:** Field workers need fast capture and next actions; supers need today, blockers and trades; PMs need schedule/budget/progress; executives need exceptions and portfolio health; clients need verified progress, financial meaning and next steps. Shared definitions; different authorized detail. “Three-second clarity” is a design goal to test, not a guaranteed performance metric.

**Visual baseline:** Preserve existing Sprint 6 charcoal/copper premium industrial language; continue refining usability and layouts. Preferred ringed bronze right-facing horse logo remains provisional and was not added in Sprint 6. Documentation must not imply a final logo approval or a UI redesign authorization.

## 4. Offline operations — targeted field workflows

Confirm the companion handoff's decision: selective offline field reports, photos, task/punch observations, downloaded plans, cached schedule and essential project details; online-only authoritative approvals, financial actions, permission changes and high-risk schedule operations initially. Explicit states: saved locally / pending / syncing / confirmed / failed or conflict. Never treat local save as server confirmation. Address device security, tenant isolation, revocation, stale documents, durable operation IDs, retries, versioning and conflict resolution. **Future work, not current sprint scope.**

## 5. Engineering-status correction (supersedes older handoff §8)

Sprint 3 client-writable save-receipt forgery was **reproduced, fixed and isolated-test verified**; PR #3 updated at `229f3af9d68ca6de973fa6426b608ec54245b004`. Fix revokes client receipt writes, restricts receipt creation to trusted transactional RPC, retains pre-fix receipts as untrusted, and preserves retries, concurrency and tenant isolation. Full Sprint 3–6 compatibility suites and builds reportedly passed; browser acceptance not rerun for SQL-only change. Two Sprint 3 migrations must run before submissions reopen.

**Production remains NO-GO** until independently verified full database **and Storage bytes** backup/restore, preflight/schema/ACL and Railway checks, write-pause controls, migration/release rehearsal and explicit approval. Do not merge, migrate or deploy during this documentation audit. Existing uncommitted `PROGRESS.md` and release documentation must be preserved.

## 6. Required audit approach

- Compare this addendum **and** the companion handoff against the actual repository (existing docs, schema, RLS, API, UI, tests, branches/PRs) rather than treating conversation-derived claims as code truth.
- Seek historical decisions from the original Projects PM and other SITEPM/LINEHORSE conversations **only if those transcripts are actually supplied or accessible**. Do not claim to have audited inaccessible chats; list source gaps for founder follow-up.
- Classify each capability as implemented+verified, implemented but unverified, committed product direction, planned, exploratory, superseded or unresolved; distinguish **source evidence** from inferred implementation status.
- Identify contradictions and stale documentation; report before changing disputed decisions. No speculative feature creep.
- Prefer a small canonical document set, linked to existing `PROGRESS.md` and engineering docs, with dated decision log, discovery log, feature inventory, phased roadmap and design baseline. Do not duplicate or overwrite established docs.
- Documentation-only changes on a dedicated branch or safe existing branch, with an explicit diff and audit report; no application code, migrations, production actions or release authorization.
