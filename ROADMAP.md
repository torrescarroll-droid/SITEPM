# LINEHORSE product roadmap

Aligned with [PRODUCT_VISION.md](PRODUCT_VISION.md) and the canonical [product architecture](docs/PRODUCT_ARCHITECTURE.md). Implementation state and release state are separate.

| Milestone | State | Operational outcome |
| --- | --- | --- |
| Week 11 / Sprint 2 core operations and lookahead | Production baseline `12a0615` | Projects, tasks, field records, operational follow-ups, 14-day lookahead |
| Sprint 3 field-data reliability | Implemented, PR #3 at `44e5bda`; not released | Atomic report/crew saves, recovery, idempotency, isolated write acceptance |
| Sprint 4 construction scheduling and workforce coordination | Implemented on a branch stacked on Sprint 3; integrity defects resolved in isolated acceptance; ready for engineering review with production release prerequisites | Functional month/week/day project and company calendars, reusable resource directory, assignments, status, history, transactional saves |
| Next scheduling milestone | Planned | Contractor pilot feedback, larger-calendar query/windowing, resource capacity and dependency editing usability; validate actual-vs-planned evidence links before analytics |
| Gantt and schedule analytics | Planned, not implemented | Dependency graph UI, explicit baselines/actuals, schedule variance, critical path, forecasting, labor/cost-code integration after data and customer validation |

Sprint 4 implements the previously requested scheduling UI direction. Trade colors stay stable; status uses separate text. No schedule reference image was found in the inspected project materials. Functional inspiration comes from publicly documented construction scheduling workflows, with original LINEHORSE UI and code. See [Sprint 4 implementation and acceptance](docs/CONSTRUCTION_SCHEDULING_SPRINT_2026-10-08.md).

Release order: verify production backup/recovery, authorize and release Sprint 3, review/authorize Sprint 4 migration and application release. Neither sprint is authorized for production changes by the Sprint 4 assignment. Do not infer deployment from an implementation milestone.

Parallel business workstreams remain customer discovery, private beta recruitment, pricing/monetization validation, and marketing toward 10 paying contractors. These are business priorities, not extra Sprint 4 engineering deliverables.
