# SITEPM Product Architecture

Status: documentation only. This file does not authorize schema, ingestion, or application work.

Related: `SITEPM_BUILD_SPEC.md`, `docs/DATA_INGESTION_ARCHITECTURE.md`, `docs/DATA_SOURCE_REGISTRY.md`.

Accepted implementation baseline: `f3f612cede4d95198a4378aea2f46a4a4cdb4420` (`feat: add secure project documents`).

## Time layers (read this first)

| Layer | Meaning | Authorization |
| --- | --- | --- |
| Current implemented state | Auth, company RLS, Projects, Tasks, Field Logs, Documents (PDF Storage) | Live |
| Next MVP work | Ask SITEPM / Intelligence V1 over **existing project records** | Next implementation milestone only |
| Long-term architecture | Property record, document intelligence, construction/regulatory knowledge, bilingual field bridge | Design only until a later milestone |
| Future research / data acquisition | Licensing, jurisdiction corpora, plan-format study, optional Class D governance | Research; no ingest until terms are verified |

Do not implement Property, Construction Knowledge, Regulatory Knowledge, or bilingual engines because this document exists. Do not start Ask SITEPM from this file.

## 1. Core thesis

SITEPM is evolving from construction **project history** into **construction data and operating infrastructure**, including a persistent digital memory of the **physical property**.

The application is the wedge. The durable asset is a trusted system of record: structured, longitudinal information about companies, people, projects, properties, plans, specifications, tasks, trades, materials, equipment, field events, photos/video, documents, decisions, RFIs, submittals, change orders, costs, estimates, installations, inspections, warranties, service history, maintenance, and building history.

**Evidence-first / provenance-first:** SITEPM should distinguish documented fact, derived inference, general construction knowledge, and uncertainty. Answers should identify their evidence whenever practical. Models are replaceable; provenance is not.

Durable value should come from:

- structured project and property data
- historical records and accumulated field evidence
- construction ontology/relationships (SITEPM-owned, not a third-party BIM product)
- provenance
- permissions and tenant isolation
- workflows
- integrations
- appropriately governed proprietary knowledge
- APIs that future agents can operate

SITEPM should gain additional knowledge over time without redesigning the entire system. Future agents should **operate SITEPM** through identity, tenant/project (and later property) scopes, audit, and human approval for sensitive actions.

This is compatible with the V1 principle in `SITEPM_BUILD_SPEC.md`: SITEPM is not a giant suite in V1. Humans approve consequential actions.

## 2. Current implemented state

Accepted now (user-scoped JWTs, company RLS, no service-role for normal operations):

- authentication and cookie sessions
- company + owner profile on signup
- company-scoped RLS (`current_company_id()`)
- live Projects
- live Tasks
- live Field Logs
- live Documents: private `project-documents` bucket, PDF-only, 20 MiB, pending → ready | failed, 60s signed URLs after authorized ready lookup

Still demo / not started:

- Ask SITEPM
- AI briefing
- Field photos as a first-class evidence type (logs exist; photo capture is later in the build spec)
- Property schema, RFIs, submittals, document extraction, construction/regulatory corpora, bilingual interpretation

Postgres remains the system of record. Do not migrate production into a graph database.

Current tables:

```
auth.users → profiles → companies → projects → tasks
                                      ↘ field_logs
                                      ↘ documents (+ Storage objects)
```

Authorization today: `auth.users` → `profiles.company_id` → `current_company_id()` → project-scoped rows. Inserts align `company_id` from the parent project. Anonymous access is not allowed. Documents Storage paths are `{company_id}/{project_id}/{document_id}/{filename}.pdf`.

A project `address` string is **not** a Property record. Do not create property/building/component tables until a later, reviewed milestone explicitly authorizes them.

## 3. Next MVP work

Preserve this sequence:

**Projects → Tasks → Field Logs → Documents → Ask SITEPM / Intelligence**

Ask SITEPM V1 should operate over the **secure project information already built**:

- Project Knowledge: projects, tasks, field logs, documents (and later photos/RFIs/submittals when those exist)

V1 should remain project-grounded, cite sources when possible, and refuse to invent project facts. It should **not** require:

- a living property graph
- extracted door/finish/product schedules
- a general construction knowledge base
- a jurisdiction/code corpus
- bilingual interpretation engines

Those capabilities must be addable later without rewriting V1 identity, RLS, or project scoping. Document intelligence in V1, if any, stays limited to what the Ask milestone specifies (for example retrieval over uploaded PDFs), not a full as-built component model.

Then: contractor beta and real-user validation. Do not expand the immediate MVP solely to match this architecture.

## 4. Knowledge classes (interoperable, not interchangeable)

Language (English/Spanish construction-aware interpretation) operates **across** these classes. Language is not a separate source of truth.

| Class | What it is | Privacy default | Ask SITEPM V1 |
| --- | --- | --- | --- |
| **Project Knowledge** | This job: projects, tasks, field logs, documents; later photos, RFIs, submittals, decisions | Class B tenant-private | **In scope** |
| **Property Knowledge** | What physically exists at a particular property: installed components, finishes, concealed conditions, service/replacement history | Class C when authorized to outlive a job; otherwise Class B | Out of scope |
| **Company Knowledge** | SOPs, historical jobs, preferred details, internal lessons, approved vendors/trades | Class B | Out of scope except incidental project fields already stored |
| **Construction Knowledge** | General U.S. building/trade intelligence (methods, materials, failure modes, diagnostics) | Class A only with verified license/terms; never mix with tenant jobs | Out of scope |
| **Regulatory Knowledge** | Jurisdiction- and edition-specific requirements | Distinct from Construction Knowledge; licensed/cited per jurisdiction | Out of scope |

Do not collapse these into one generic “SITEPM knows construction” answer. A project fact, a property fact, a trade practice, and a code citation are different claims.

## 5. Evidence-first intelligence

Prefer evidenced answers over unsupported yes/no.

Example — “Is there electrical wiring behind this wall?”

Preferred shape:

> Project records indicate an electrical run in this area based on the pre-drywall photo dated X and electrical drawing E-X. Verify physically before drilling.

Not: an unsourced “yes.”

Conceptual provenance chain:

```
claim
  → evidence
  → source
  → version/date
  → project/property context
```

Distinguish at least:

| Kind | Meaning |
| --- | --- |
| Documented fact | Authorized SITEPM record or retained original evidence (field log, ready document, photo) |
| Derived inference | Extraction or model/rule conclusion from evidence |
| General construction knowledge | Class A trade/practice, not this job |
| Regulatory citation | Specific jurisdiction + edition, not “the code” |
| Uncertainty | Missing evidence, conflict, or unverified physical condition |

SITEPM must preserve the underlying evidence used to answer questions. Structured knowledge is derived; it does not replace originals.

## 6. Living Property Record (long-term, not schema now)

SITEPM should eventually hold persistent digital memory of the physical place, not only the construction job.

Conceptual hierarchy (relationships, not tables to create now):

```
Property → Building → Floor → Room/Area → System/Assembly → Component → Installed Product → Evidence/History
```

The property record should eventually support, among other things:

- as-built plans; architectural/engineering drawings; specifications
- door/window/finish/hardware/equipment schedules
- submittals; RFIs and decisions
- installed products: manufacturer, model/SKU, serial where appropriate, finish/color/patina, dimensions
- supplier; responsible trade; installation date
- warranty; manuals; receipts
- service/repair and replacement history
- installation and closeout photos
- concealed-condition documentation **before** walls/floors/ceilings are closed

Example future questions (Property Knowledge + evidence, not V1 Ask):

- What finish is the Primary Bedroom door hardware?
- What model faucet is installed in Bathroom 2?
- What paint was used on these cabinets?
- Where is the irrigation shutoff?
- Which replacement filter does this air handler use?
- Is there electrical/plumbing/blocking behind this wall?
- Show me what was behind this wall before drywall.
- Who installed this component?
- Is it still under warranty?

Authorization remains company-scoped unless a later reviewed design defines Class C owner/contract contracts. Do not weaken RLS to share properties across tenants.

## 7. Construction document intelligence (long-term)

Documents must eventually become more than opaque PDFs. Current Documents MVP stores private PDFs with metadata and status; that is correct for now.

Later, SITEPM should extract structured building information from plans, specifications, schedules, submittals, manuals, and closeout documents **while retaining the original source**.

Example:

```
Door D-14
  → Primary Bedroom
  → Hardware Set 4
  → Manufacturer → Model → Finish
  → source schedule / page / detail
```

BIM/IFC and similar industry structures are **references** for organizing building/component relationships. SITEPM must **not** become BIM authoring software and must **not** adopt an external schema blindly. SITEPM owns its ontology; mappings to IFC/CSI/etc. are optional and license-gated (see the data-source registry).

Long-term ingestion should accommodate many different U.S. architectural-plan and construction-document formats. Format coverage is a research problem; no format library is acquired in this pass.

## 8. SITEPM Construction Knowledge (long-term, Class A)

Separate from any one job or property.

Conceptual relationships may include:

```
Trade → System → Assembly → Component → Material → Installation Method → Failure Mode → Diagnostic Procedure → Repair Method
```

Scope: **U.S. construction specific**, with **California as the initial deep jurisdiction**, while remaining capable of national expansion.

Potential future source **classes** (none of these are acquired or licensed by this documentation):

- legitimately usable/open construction datasets
- government publications
- federal/state/local building **guidance** (not automatically the same as copyrighted model codes)
- appropriately licensed code/standards material (see Regulatory Knowledge)
- manufacturer documentation and installation manuals
- safety guidance
- legitimately licensed/open architectural plans and construction documents
- educational construction material
- voluntary/licensed contractor and trade-expert content
- eventually anonymized / appropriately governed SITEPM historical project knowledge (Class D only)

Publicly viewable internet content is **not** automatically public domain or authorized for training/ingestion.

## 9. Regulatory / jurisdiction knowledge (long-term, distinct)

Regulatory knowledge must remain distinguishable from general construction knowledge.

Conceptual applicability chain:

```
United States → State → Local jurisdiction → applicable edition/amendment → project
```

California is the initial deep jurisdiction; SITEPM must remain capable of national expansion.

Retain at least:

- source
- jurisdiction
- edition/version
- effective dates where known
- applicability
- provenance

Do not collapse conflicting jurisdictions or code editions into one generic answer. Do not claim ICC or any AHJ text may be reproduced until a license is established (registry: RESEARCH REQUIRED).

## 10. English / Spanish construction field bridge (long-term)

First-class future capability. **Not** generic UI translation.

Eventually support:

- English superintendent/PM ↔ Spanish field communication
- trade-specific terminology
- project-context-aware interpretation
- questions against drawings/specifications/property records in either language
- structured issue creation from spoken or typed field descriptions
- preservation of **original language** alongside translated/interpreted content where appropriate

Example: a Spanish-speaking worker describes a field discrepancy. SITEPM should eventually turn that into a structured project issue for the PM while preserving the worker’s original statement and meaning.

Do not assume all Spanish-speaking workers share identical terminology or dialect. Interpretation is derived evidence; the original utterance remains the source.

Ask SITEPM V1 is not required to ship bilingual interpretation.

## 11. Long-term product family

These share one construction/property data layer. They are not current implementation tasks.

| Surface | Role |
| --- | --- |
| SITEPM Projects | PM, tasks, coordination, documents, field information |
| SITEPM Field | Voice-first capture, photo/video, daily logs, issues, safety, bilingual field bridge, field-to-office reporting |
| SITEPM Intelligence | Plans/spec understanding, RFI/submittal/CO comparison, change and risk detection, briefings, decision history, evidenced Q&A across knowledge classes |
| SITEPM Estimate | Contractor-specific cost intelligence from estimate vs actual (Class B only by default) |
| SITEPM Property | Permanent building/property record after construction |
| SITEPM Service | Warranty, maintenance, service history, installed-product intelligence |
| SITEPM Agent/API | Identity, permissions, APIs, tool interfaces, controlled access for agents and external software |

## 12. Construction Graph (conceptual)

Operational graph, implemented as relational Postgres until a later, explicit decision. Combine the **job graph** and the **place graph** without treating them as the same node:

Job (today): Company → People → Projects → Tasks → Field Events → Documents → Decisions

Place (future): Properties → Buildings → Floors → Rooms/Areas → Systems/Assemblies → Components → Installed Products → Evidence/History

Plus: Trades, Materials, Equipment, Costs, Changes, Inspections, Warranties, Service History — linked with provenance.

Example relationships:

- TASK `assigned_to` PERSON
- TASK `occurs_at` LOCATION
- PRODUCT `installed_at` LOCATION
- PRODUCT `installed_by` TRADE
- CHANGE `authorized_by` DECISION
- DECISION `supported_by` DOCUMENT
- INSTALLATION `evidenced_by` PHOTO
- SERVICE_EVENT `affects` PRODUCT
- CLAIM `derived_from` EVIDENCE

MVP equivalents already exist as foreign keys: task/field_log/document → project → company.

## 13. Field-to-office capture (future)

Workers should eventually capture via voice, text, photos, video, documents, structured forms, and sensor/device data where appropriate, in English or Spanish.

Pattern:

```
field photo + voice note (original language retained)
  → evidence record (immutable original)
  → extracted entities/events / optional interpretation
  → project / task / location / material relationships
  → searchable historical memory
```

The Field Logs MVP stays notes, date, issue flag, project association; photos remain a later build-spec item. This pipeline is the target shape, not the next PR.

## 14. Change intelligence (future)

Compare plan revisions, specifications, RFIs, submittals, change orders, field conditions, and schedule/cost implications.

SITEPM should eventually answer: what changed, why, what it affects, who approved it, and what evidence supports that conclusion. Not implemented now.

## 15. Cost and estimating memory (future)

Learn from **authorized contractor history only**:

estimate → actual labor → actual material → subcontractor cost → change orders → schedule impact → final outcome

Do not pool tenant-private cost data across customers. Cross-tenant intelligence requires Class D authorization.

## 16. Closeout / warranty intelligence (future)

A permanent closeout record should outlive project completion when Class C is authorized: installed products, manufacturer/model/serial, location, trade, installation date, photos, manuals, warranties, receipts/invoices, approved submittals, service events, repair history.

## 17. SITEPM Ingest / API layer (future)

Existing construction software need not be replaced.

```
External construction software
  → SITEPM Ingest API
  → normalization
  → Construction Graph (Postgres)
  → historical memory
  → intelligence / API / agents
```

Identity, tenant, and project (later property) scopes apply to every ingest path. Not implemented in this pass.

## 18. AI / model strategy

SITEPM’s moat must not depend on one AI model. Models remain replaceable (including the build spec’s current OpenAI mention for V1).

Long-term defensibility comes from structured data, history, ontology, provenance, permissions, workflows, integrations, field evidence, governed proprietary knowledge, and agent APIs — not from a particular model vendor.

Agents operate SITEPM through explicit:

- identity
- permissions
- company/tenant boundaries
- project (and later property) boundaries
- knowledge-class scope (do not let Construction Knowledge answer as if it were Project Knowledge)
- tool/API scopes
- audit logs
- provenance
- action history
- human approval for sensitive actions (money, contracts, external messages, legal/compliance)

The system of record remains durable when models change.

## 19. Physical AI / robotics (long term)

Drones, robotic inspection, automated capture, sensors, and physical AI may consume SITEPM property/building context. SITEPM provides structured environmental memory. SITEPM does not build robotics now.

## 20. Data ownership / privacy classes

| Class | Meaning | Default |
| --- | --- | --- |
| A | External construction/reference knowledge | Reuse only with verified license |
| B | Tenant-private project/company data | Never pooled, sold, or used cross-tenant |
| C | Authorized property/building history | Owner/contract scoped; survives project closeout only with authorization |
| D | Appropriately permitted / de-identified aggregated intelligence | Requires contractual, privacy, security, and legal authorization |

Tenant isolation is foundational. Publicly viewable does not mean reusable.

## 21. Data / product flywheel

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

Constrained at every step by privacy, contracts, provenance, licensing, and RLS. Regulatory Knowledge joins this flywheel only as cited, editioned sources — not as unlabeled “best practice.”

## 22. Future research / data-acquisition work

Not started. Do not claim datasets or code-licensing rights.

Research tracks (see `docs/DATA_SOURCE_REGISTRY.md`):

- U.S. plan and construction-document format diversity (without adopting BIM as the product)
- California-first, then national, **regulatory** source licensing (distinct from trade knowledge)
- Class A construction datasets, government publications, manufacturer docs, educational and licensed expert content
- Whether and how Class D anonymized SITEPM history could ever be authorized
- Construction Spanish/English terminology variation (not a single dialect dictionary assumed to be complete)
- Mapping SITEPM’s own ontology to IFC/CSI only after license review

## 23. Immediate next product work

**Ask SITEPM / Intelligence V1** over accepted Project Knowledge, per `SITEPM_BUILD_SPEC.md` Weeks 7–8 (AI foundation then project-grounded Q&A).

Do not start that implementation from this document. Do not implement the property schema. Do not change existing RLS from this document.
