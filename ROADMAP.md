# LINEHORSE product roadmap

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
