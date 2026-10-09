# Decision history and customer discovery

Recorded 2026-10-09. Evidence is supplied owner handoffs and repository history, not inaccessible historical ChatGPT conversations. “Accepted” below means direction explicitly present in those sources, not a new implementation/release authorization. Dates before this audit come from sprint/Git records; undated original ideas retain their source rather than invented decision dates.

## Established decisions

| ID / recorded source | Decision | Status / consequences |
| --- | --- | --- |
| A01 / canonical architecture, retained | Builder-first digital toolbag over a construction OS; scales with builder/company maturity | Accepted principle. One person, crew, PM, executive and client perspectives are connected, not separate truths. Depth levels are not pricing tiers. |
| A02 / architecture and handoff §1 | Capture reality once; useful intelligence everywhere; preserve for property life | Accepted principle. Evidence/history/permissions durable; no current property schema or automatic transfer implied. |
| A03 / architecture §§18/19/32/34 | Models replaceable; source→fact→derivation→presentation; A/B/C/D knowledge/privacy distinctions | Accepted guardrails. No AI approval, tenant pooling, unlicensed corpora or implied physical verification. |
| A04 / Sprint 3 at 44e5bda, correction 229f3af | Atomic field-save path and trusted receipts; isolated evidence required | Implemented; new receipt integrity fix supersedes original client-writable receipt boundary. Legacy direct paths retain documented limits. Release not authorized by this audit. |
| A05 / Sprint 4 at 870f9a2 | Real calendars, shared resource directory, planned≠actual, transactional write boundary | Implemented, isolated hardening evidence. Revisions, receipt restrictions, concurrent cycle prevention and inactive-resource rules retained. |
| A06 / explicit Sprint 5 approval / 5f3403a | Immutable versions, explicit current promotion, project-authorized/company-scoped access, archive/restore, safe formats, exact-version links, bounded processing | Implemented. Current≠approved-for-construction; retain original bytes, exact citations and source/AI separation. |
| A07 / Sprint 6 at 61fd8fc | Charcoal/midnight shell, copper/amber, warm surfaces, dense legible reusable patterns | Implemented. Multi-role design; no simulated permissions or mockup-only features. Baseline can be refined through measured feedback, not silently replaced. |
| A08 / handoff §§1/7 and addendum §3 | LINEHORSE preferred brand; Construction Intelligence; KEEP YOUR PROJECT RUNNING; BUILT FOR BUILDERS, BY BUILDERS; Clarity at Every Level | Accepted direction. SITEPM remains repository/platform context; no legal clearance or final logo approval. |
| A09 / handoff §2 | Identity, authority and workspace personalization separate; Observe→Override authority vocabulary | Accepted future direction. Current role strings do not implement this matrix. Scope and approval design remain Q02. |
| A10 / addendum §§1/2 | Verified progress distinct from time/cost; shared role-appropriate project health and restricted client workspace | Accepted future product requirement, not approved accounting formula or implementation. Preserve separate billing/payment states. |
| A11 / handoff §6 and addendum §4 | Selective offline field workflows, explicit sync states, safe retries/conflicts | Accepted future direction. No whole-app offline promise; scope and device security require Q09. |
| A12 / handoff §9 | Private beta/customer learning before more major feature commitments; ten paying companies aspiration | Accepted business direction. Recruitment, pricing and dates remain experiments/targets, not achieved outcomes. |
| A13 / release records and addendum §5 | Ordered releases 3→4→5→6; verified DB+Storage recovery and explicit authorization | Unresolved release gate. No main merge, production access/migration/deployment by this audit. |

## Customer discovery register

These are secondhand anecdotes supplied by the owner. No interview transcript, recording, customer identity, sample count beyond the described conversations, purchase commitment or independently validated vendor behavior was provided. Record counterevidence when discovered; do not overwrite the original observation.

| ID | Observation / source | Interpretation, confidence and next validation |
| --- | --- | --- |
| D01 / 2026-10-09 handoff §4 | Coworker considers Buildertrend useful for smaller jobs and prefers Microsoft tools for larger/complex scheduling; references Gantt, predecessors and downstream delays | One reported viewpoint, not a comparative benchmark. Which Microsoft product/version? Actual sample schedule size, dependency types, recalc behavior, resource constraints and pain? Interview more PMs/supers across target segments before choosing a master-schedule engine. |
| D02 / handoff §5 | Project information fragmented across SharePoint/OneDrive/Dropbox/Google Drive/email/firm repositories | Federation hypothesis. Validate who controls permissions, desired read/write sync, version approval, retention and source-of-truth; confirm contract/API access. Do not infer demand for every connector. |
| D03 / addendum §1 | Coworker reportedly uses Sage 100, “Buildermaster” and spreadsheets; PMs re-enter project information and answer client status questions | Product name/spelling/version unconfirmed. Observe workflow/data exports and approval roles, existing accounting truth and duplicate effort; validate alternatives. No integration commitment or claim of actual Sage API compatibility. |
| D04 / addendum §1 | Monthly pay requests reportedly based on original scope/quote values and actual completion | Scope-weighted verified progress opportunity. Confirm fixed-price/T&M/cost-plus, SOV, quantities, stored materials, retainage, approved changes, prior billings and signoff. Not a universal accounting/revenue-recognition rule. |
| D05 / handoff §9 | Initial beta may recruit 3–5 contractor acquaintances, then referrals/outreach | Recruitment hypothesis, not active pilot or paid traction. Confirm participants, project types, privacy, support and success criteria. |
| D06 / architecture §§9/15 and handoff | Solo trade contractors through growing companies have differing digital literacy and responsibilities | Product segmentation hypothesis grounded in owner direction. Test the same shared workflows with solo, crew, PM/executive users; do not assume one workspace or price fits all. |

## Decisions requiring owner input before related implementation

These questions do not block this documentation audit or authorize new work. Routine existing implementation decisions remain engineering responsibilities. Default restrictions preserve privacy and avoid inventing financial authority until approved.

| ID | Decision needed | Why / proposed next evidence |
| --- | --- | --- |
| Q01 | Confirm beta-first priority and which capability follows release/pilot hardening: verified progress, selective offline, or master scheduling | Handoffs preserve all three, not a funded ordering. Recommend discovery/pilot evidence before selecting one coherent sprint. |
| Q02 | Define project membership and role/action authority, including who may verify, approve, issue, override and share externally | Current one-company profile model insufficient for confidential client/financial workflows. Need role-resource-action examples, delegation and separation-of-duties expectations. |
| Q03 | Define physical-progress units, scope weighting and evidence/reviewer standard | Quantities vs milestones vs value weights, original vs revised contract, partial approval/reversals and accountable verifier. Obtain real anonymized examples. |
| Q04 | Define financial/billing scope and accounting source of truth | Client pay applications vs subcontractor applications; contract types, stored materials, retainage, taxes, credits, cutoff and reconciliation. Validate with qualified accounting stakeholders. |
| Q05 | Confirm accounting products and integration priority | Identify “Buildermaster”, Sage edition/version and access rights; choose read-only export/import vs API after discovery, not guesswork. |
| Q06 | Approve client visibility/publishing and portal MVP | Which measures, documents/photos/messages and change actions can each client see? Default exclude internal margin, prices, rates and drafts. Resolve aggregate disclosure. |
| Q07 | Choose master-schedule segment and recalculation policy | Confirm Microsoft tool and required durations/dependency types/calendars; proposal-first/manual vs automatic movement; baseline approval ownership. |
| Q08 | Select first federation source and retention/approval model | External access/revocation, reference vs cached bytes, source authority, sync failure/deletion and license terms. |
| Q09 | Approve first offline subset, device/privacy policy and physical-device acceptance matrix | Cached private information cannot be remotely recalled instantly offline; define risk, expiry/key/storage behavior and shared-device limits. |
| Q10 | Confirm beta cohort, success criteria and pricing experiment | $99–149/company/month and April 2027 are hypotheses/aspirations, not approved public promises. Company depth must not silently become paid entitlements. |
| Q11 | Finalize logo/brand legal review when ready | Right-facing copper horse profile is exploratory preference; current wordmark/system remains. No supplied final asset or trademark clearance. |
| Q12 | Authorize release execution only after recovery/preflight/review gates pass | Backup/restore proof, exact migrations, maintained write pauses, restricted writers/verifier and deploy/rollback control required. Documentation cannot waive safeguards. |

## Superseded status, retained history

- Architecture's early “Stage 3/no PDF/Stage 4 not started” time layer is historical; later Stage 4 code, tests, PROGRESS and Sprint 5 clarification establish bounded digital-PDF intelligence. It does not authorize unrelated OCR/AI work.
- Original roadmap “Sprint 5 browser pending” is superseded by `5f3403a` acceptance completion; physical-device and other documented gaps remain.
- First handoff's pending Sprint 3 receipt investigation and original `44e5bda` release head are superseded by addendum and published `229f3af`. New release candidate still needs review and ordered integration.
- The original mockup and older working-desk language are visual guidance, not evidence of financials, client portal, equipment management, actual attendance or superintendent-only scope.
- Existing front-facing horse exploration is not final; newer profile preference does not approve a logo or replace Sprint 6 with a new design.
