# SITEPM Product Architecture

Status: documentation only. This file describes long-term direction. It does not change the accepted Week 5 MVP.

Related: `SITEPM_BUILD_SPEC.md`, `docs/DATA_INGESTION_ARCHITECTURE.md`, `docs/DATA_SOURCE_REGISTRY.md`.

## 1. Core thesis

SITEPM is evolving from a contractor project-management application into **construction data and operating infrastructure**.

The application is the wedge. The durable asset is a trusted system of record: structured, longitudinal information about companies, people, projects, properties, plans, specifications, tasks, trades, materials, equipment, field events, photos/video, documents, decisions, RFIs, submittals, change orders, costs, estimates, installations, inspections, warranties, service history, maintenance, and building history.

The AI model is not the moat. Models should be replaceable. Durable value should come from:

- proprietary project and property data
- historical memory
- normalized construction knowledge
- workflow relationships
- permissions
- provenance and evidence
- integrations
- APIs
- accumulated operational history

Future general AI agents should **operate SITEPM**, not make SITEPM obsolete.

This is compatible with the V1 principle in `SITEPM_BUILD_SPEC.md`: SITEPM is not a giant suite in V1. Humans approve consequential actions. The architecture below is the destination; the MVP remains the path.

## 2. Current product as the wedge

Accepted now:

- authentication and cookie sessions
- company + owner profile on signup
- company-scoped RLS
- live Projects
- live Tasks
- Field, Documents, Ask SITEPM, and AI briefing still demo

Near-term sequence (do not skip ahead because this document exists):

Projects → Tasks → Field Logs → Documents → Ask SITEPM / Intelligence → contractor beta → real-user validation

Do not expand the MVP solely to match this architecture.

## 3. How the current schema maps

Postgres remains the system of record. Do not migrate production into a graph database.

Current tables (Week 3–5):

```
auth.users → profiles → companies → projects → tasks
                                      ↘ field_logs (table exists; app not live)
```

Authorization today: `auth.users` → `profiles.company_id` → `current_company_id()` → project and task rows. Task inserts align `company_id` from the parent project. Anonymous access is not allowed.

Future entities (properties, documents, costs, warranties, and so on) should attach to this same company/project boundary unless a later, reviewed design introduces an authorized property-history class with explicit contracts.

## 4. Long-term product family

These share one construction/property data layer. They are not current implementation tasks.

| Surface | Role |
| --- | --- |
| SITEPM Projects | PM, tasks, coordination, documents, field information |
| SITEPM Field | Voice-first capture, photo/video, daily logs, issues, safety, material observations, field-to-office reporting |
| SITEPM Intelligence | Plans/spec understanding, RFI/submittal/CO comparison, change and risk detection, briefings, decision history |
| SITEPM Estimate | Contractor-specific cost intelligence from estimate vs actual, labor, materials, subcontractors, COs, outcomes |
| SITEPM Property | Permanent building/property record after construction |
| SITEPM Service | Warranty, maintenance, service history, installed-product intelligence |
| SITEPM Agent/API | Identity, permissions, APIs, tool interfaces, controlled access for agents and external software |

## 5. Construction Graph (conceptual)

Operational graph, implemented as relational Postgres until a later, explicit decision:

Company → People → Projects → Properties → Plans → Tasks → Trades → Materials → Equipment → Costs → Changes → Field Events → Documents → Decisions → Installations → Inspections → Warranties → Service History

Example relationships:

- TASK `assigned_to` PERSON
- TASK `occurs_at` LOCATION
- PRODUCT `installed_at` LOCATION
- PRODUCT `installed_by` TRADE
- CHANGE `authorized_by` DECISION
- DECISION `supported_by` DOCUMENT
- INSTALLATION `evidenced_by` PHOTO
- SERVICE_EVENT `affects` PRODUCT

MVP equivalents already exist as foreign keys: task → project → company; task `assigned_to` profile (column exists; assignment UX is not the current priority).

## 6. Field-to-office capture (future)

Workers should eventually capture via voice, text, photos, video, documents, structured forms, and sensor/device data where appropriate.

Pattern:

```
field photo + voice note
  → evidence record (immutable original)
  → extracted entities/events
  → project / task / location / material relationships
  → searchable historical memory
```

Raw evidence is retained. Structured knowledge is derived, not a replacement for the original.

## 7. Change intelligence (future)

Compare plan revisions, specifications, RFIs, submittals, change orders, field conditions, and schedule/cost implications.

SITEPM should eventually answer: what changed, why, what it affects, who approved it, and what evidence supports that conclusion. Not implemented now.

## 8. Cost and estimating memory (future)

Learn from **authorized contractor history only**:

estimate → actual labor → actual material → subcontractor cost → change orders → schedule impact → final outcome

Do not pool tenant-private cost data across customers. Cross-tenant intelligence requires class D authorization (see privacy classes).

## 9. Closeout / warranty intelligence (future)

A permanent closeout record should outlive project completion: installed products, manufacturer/model/serial, location, trade, installation date, photos, manuals, warranties, receipts/invoices, approved submittals, service events, repair history.

## 10. Property / building memory (future)

Potential hierarchy:

Property → Building → Floor → Room → Assembly → Component → Product → Manufacturer

Example future query: “What waterproofing system is behind the primary shower walls at 184 Maple, who installed it, what drawing revision authorized it, when was it installed, what warranty applies, and have there been moisture issues?”

Today the MVP stores a project `address` string, not a property graph. Do not invent property tables until Field/Documents demand them.

## 11. SITEPM Ingest / API layer (future)

Existing construction software need not be replaced.

```
External construction software
  → SITEPM Ingest API
  → normalization
  → Construction Graph (Postgres)
  → historical memory
  → intelligence / API / agents
```

Identity, tenant, and project scopes apply to every ingest path. Not implemented in this pass.

## 12. AI agent infrastructure (future)

Agents operate SITEPM through explicit:

- identity
- permissions
- company/tenant boundaries
- project boundaries
- tool/API scopes
- audit logs
- provenance
- action history
- human approval for sensitive actions (money, contracts, external messages, legal/compliance)

The system of record remains durable when models change.

## 13. Physical AI / robotics (long term)

Drones, robotic inspection, automated capture, sensors, and physical AI may consume SITEPM property/building context. SITEPM provides structured environmental memory. SITEPM does not build robotics now.

## 14. Data ownership / privacy classes

| Class | Meaning | Default |
| --- | --- | --- |
| A | External construction/reference knowledge | Reuse only with verified license |
| B | Tenant-private project/company data | Never pooled, sold, or used cross-tenant |
| C | Authorized property/building history | Owner/contract scoped; survives project closeout only with authorization |
| D | Appropriately permitted / de-identified aggregated intelligence | Requires contractual, privacy, security, and legal authorization |

Tenant isolation is foundational. Publicly viewable does not mean reusable.

## 15. Data / product flywheel

```
External Construction Knowledge (Class A, licensed)
  → SITEPM Knowledge Foundation
  → Contractor Projects (Class B)
  → Real-World Execution Data
  → Property History (Class C)
  → Better Construction Intelligence
  → More Useful Products/APIs
  → More Customers/Data
```

Constrained at every step by privacy, contracts, provenance, licensing, and RLS.

## 16. Immediate next product work

Per `SITEPM_BUILD_SPEC.md` and accepted Week 5: **Field Logs** next, then Documents, then Ask SITEPM. Project edit/close/reopen remains in the Week 5 remainder if not already complete.

Do not start those implementations from this document.
