# SITEPM Product Architecture

Status: documentation only. This file is the **canonical product true north**. It does not authorize schema, ingestion, or application work.

Related: `SITEPM_BUILD_SPEC.md`, `docs/DATA_INGESTION_ARCHITECTURE.md`, `docs/DATA_SOURCE_REGISTRY.md`.

Accepted implementation baseline: Ask SITEPM V1 **Stage 2** (`021c690e670dde22d1aa3659bf377397f3082dc9`, `feat: add secure project-scoped Ask evidence retrieval`). Documents foundation remains `f3f612c`.

## Time layers (read this first)

| Layer | Meaning | Authorization |
| --- | --- | --- |
| Current implemented state | Auth, company RLS, Projects, Tasks, Field Logs, Documents, Ask Stages 1–2 (project-scoped evidence retrieval, **no model**) | Live |
| Next MVP work | Ask SITEPM V1 **Stage 3** (replaceable model + epistemic answers + allowlist-validated citations) | Next implementation milestone only; **not started** |
| Long-term architecture | Digital Toolbag over Construction OS; Builder–Technology Gap; Field-to-Office; two-way field intelligence; contractor maturity / product depth; Construction Spectrum; Property; knowledge classes; voice; bilingual; estimating | Design only until a later milestone |
| Future research / data acquisition | Licensing, jurisdiction corpora, naming/brand, plan-format study, optional Class D governance | Research; no ingest until terms are verified |

Do not implement Property, Construction Knowledge, Regulatory Knowledge, bilingual engines, voice OS, Field-to-Office Pipeline, Jobsite Copilot, estimating, or communications because this document exists. **Do not start Ask Stage 3 from this file.**

## 1. Core thesis — builder-first digital toolbag + construction operating system

SITEPM is evolving into a **builder-first digital toolbag** backed by a **construction operating system**.

The visible product should feel like a useful construction tool. The underlying system may be sophisticated, structured, and highly automated. The builder should not have to understand that complexity.

**Complexity belongs inside SITEPM, not on the builder’s desk.**

SITEPM should learn how builders work rather than requiring builders to learn how construction software works. It must serve people who are excellent builders but have little interest, experience, or ability with traditional computer-based PM software. A skilled carpenter, fence builder, concrete worker, remodeler, handyman, foreman, or subcontractor should obtain substantial value **without sitting at a desk**.

The product should increasingly feel like **another tool in the builder’s toolbag**, not another administrative system they have to maintain.

Commercial/economic promise (outcomes to measure later, not unsupported claims): **save time, save money, make money.**

Complementary product true north (same system, increasing depth — not separate missions):

**Give the person who builds more capability, give the person who runs the job more leverage, and give the person who runs the company more control.**

Technical true north remains: **turn the messy stream of information produced by construction into structured, trustworthy, actionable project and property state.**

**SITEPM scales with the builder, not away from the builder.** Builder-first does **not** mean field-worker-only. SITEPM remains fundamentally an AI project manager / construction operating system for contractors. Digital Toolbag and Field Intelligence **extend that system down to where construction work and construction information originate.**

SITEPM should not require every participant to speak the same professional, technical, digital, or human language. It should understand enough of the relationships between those worlds to help them work together. The builder should not have to become a PM. The PM should not have to become a carpenter. The client should not have to become a contractor. SITEPM should not pretend to replace any of them. It should provide **connective intelligence** between them.

Additional principles:

- Give builders more tools, not more software to manage.
- Sophisticated underneath. Familiar on top.
- Capture once. Use everywhere appropriate.
- The contractor generates construction activity. SITEPM generates structure, intelligence, workflows, history, and leverage.

Design tests:

> Could a great builder who hates computers understand the value of this capability within 60 seconds?

> Could this builder obtain meaningful value without ever sitting at a desk?

The durable asset remains a trusted system of record: structured, longitudinal information about companies, people, projects, properties, plans, specifications, tasks, trades, materials, equipment, field events, photos/video, documents, decisions, RFIs, submittals, change orders, costs, estimates, installations, inspections, warranties, service history, maintenance, and building history.

**Evidence-first / provenance-first:** distinguish documented fact, derived inference, general construction knowledge, and uncertainty. Models are replaceable; provenance is not.

**AI defensibility:** SITEPM must not depend on having a smarter general-purpose model than OpenAI, Anthropic, Google, or future providers. Test: “Could a general AI with access to the contractor’s files do this?” If yes, the capability may still be valuable but is not alone a durable moat. Durable assets: canonical structured state, ontology, evidence, workflows, permissions, integrations, historical outcomes, estimate-vs-actual, company-specific production knowledge, project/property history, safe action APIs, specialized construction/regulatory context.

Future general AI agents should **operate SITEPM** through identity, tenant/project (and later property) scopes, audit, and human approval for sensitive actions. SITEPM should benefit from stronger models rather than be made obsolete by them.

This remains compatible with `SITEPM_BUILD_SPEC.md`: SITEPM is not a giant suite in V1. Humans approve consequential actions. AI interpretation is never authorization.

### Builder–Technology Gap (fundamental product problem)

The problem is **not primarily language**.

Construction contains highly capable builders and tradespeople whose practical construction intelligence may greatly exceed their ability or desire to operate conventional digital tools. A worker may be exceptional at building, troubleshooting, sequencing, material selection, visualizing assemblies, solving field problems, operating equipment, coordinating trades, recognizing quality problems, and estimating effort from experience — while having little proficiency with Word, Excel, email composition, formal estimating software, PM software, digital documentation, file organization, structured forms, professional business writing, or conventional computer workflows.

This is **not** a deficiency SITEPM should require the builder to correct. SITEPM should **bridge** it.

**The builder provides construction intelligence. SITEPM provides digital leverage.**

Digital literacy must **not** be a prerequisite for meaningful SITEPM value. A highly capable **native-English-speaking** builder who has never opened Word is just as important to this architecture as a monolingual Spanish-speaking builder. Language is **one component** of the larger Builder–Technology Gap.

**SITEPM does not replace the builder’s knowledge. It gives that knowledge more leverage.** It is a capability multiplier for gaps in digital literacy, administration, professional writing, language, estimating, calculation, documentation, retrieval, product knowledge, plan/spec access, communication, and project visibility — without pretending to replace construction skill, licensed professionals, engineers, qualified supervision, inspectors, manufacturer requirements, safety procedures, or professional judgment.

Additional design tests:

> Could an excellent builder who has never opened Word successfully use this?

> Can the worker contribute valuable project intelligence without knowing where that information belongs in project-management software?

If no, reconsider the workflow.

## 2. Current implemented state

Accepted now (user-scoped JWTs, company RLS, no service-role for normal operations):

- authentication and cookie sessions
- company + owner profile on signup
- company-scoped RLS (`current_company_id()`)
- live Projects, Tasks, Field Logs
- live Documents: private `project-documents` bucket, PDF-only, 20 MiB, pending → ready | failed, 60s signed URLs after authorized ready lookup
- Ask SITEPM Stages 1–2: project-scoped Ask; `/ask` is a job picker; deterministic retrieval of project + tasks + field logs + **ready** document metadata; citation allowlist; **no model call**

Still not started / later:

- Ask Stage 3 (model + epistemic answers + validated citations)
- Ask Stage 4 (PDF intelligence)
- AI briefing
- Field photos as a first-class evidence type
- Property schema, RFIs, submittals, construction/regulatory corpora, bilingual interpretation, voice OS, estimating, communications layer

Postgres remains the system of record. Do not migrate production into a graph database.

Current tables:

```
auth.users → profiles → companies → projects → tasks
                                      ↘ field_logs
                                      ↘ documents (+ Storage objects)
```

Authorization today: `auth.users` → `profiles.company_id` → `current_company_id()` → project-scoped rows. Ask retrieval is **stricter than company RLS**: Ask on Project A must not retrieve Project B even if the user can open both jobs. Anonymous access is not allowed.

A project `address` string is **not** a Property record. Do not create property tables until a later milestone authorizes them.

## 3. Next MVP work (unchanged sequence; Stage 3 not started)

**Projects → Tasks → Field Logs → Documents → Ask SITEPM / Intelligence**

Ask V1 Stage 3 (when authorized) remains **project-grounded** over existing Project Knowledge. It should **not** require a property graph, extracted schedules, a general construction corpus, a jurisdiction/code corpus, bilingual engines, voice OS, or estimating.

Do not expand the immediate MVP solely to match this architecture. **Architecture breadth is not MVP breadth.** Future capabilities are earned through customer validation, usage, ROI, strategic data value, differentiation, technical dependency, and system-of-record contribution.

## 4. Digital Toolbag (visible layer)

**Digital Toolbag** is the canonical builder-facing product/UX concept: construction capabilities in terms builders naturally understand, not enterprise-software modules.

Potential capability categories (**not** current MVP commitments):

ASK · MEASURE · IDENTIFY · CALCULATE · TAKEOFF · ESTIMATE · PRICE · CODE · TRANSLATE · DOCUMENT · COMMUNICATE · SCHEDULE · ORDER · DIAGNOSE · RESEARCH · SERVICE

Example intents (future): identify material/species/finish; yards of concrete; drywall or fence material; California code here; what to charge; write an estimate; measurements → material list; labor hours; what’s wrong with this install; find a manual; what did we install in this bathroom; document what I just said; tell the client we’re delayed; what do I need to handle today.

The user should increasingly reach these through **natural conversation** (and later voice) rather than navigating separate software modules.

**Truck Test:** if a contractor cannot accomplish a common field workflow from the truck using primarily voice in roughly a minute, question whether the workflow is unnecessarily complicated.

Relationship (long-term; not current implementation):

```
DIGITAL TOOLBAG          (field-facing capability layer)
        ↕
TWO-WAY FIELD INTELLIGENCE
        ↕
CONSTRUCTION OPERATING SYSTEM   (authoritative structured state)
```

Field-to-Office is the **ingestion/structuring** pipeline on that vertical. The field experience can stay extremely simple while the OS becomes more sophisticated. Ask is one interface into Intelligence, not the definition of Field Intelligence. The vertical (Toolbag ↔ two-way intelligence ↔ OS) is the **field information-flow** view. The stack below is the **product-depth** view of the same system.

Canonical product stack (one system with increasing depth — **not** disconnected products):

```
DIGITAL TOOLBAG
  Individual capability / simple field-facing tools
        ↓
AI PROJECT MANAGER
  Job and coordination capability
        ↓
CONSTRUCTION OPERATING SYSTEM
  Company capability / authoritative operational state
        ↓
BUSINESS + PROPERTY + HISTORICAL INTELLIGENCE
  Long-term organizational and property capability
        ↓
CONTROLLED AGENT / API INFRASTRUCTURE
  Ecosystem capability
```

Boundaries overlap. A user may consume several layers at once (solo contractor: Toolbag + AI PM + business intelligence; superintendent: Toolbag + project intelligence; established contractor: field workers still use the simplest Toolbag interface). Different interfaces over the **same authorized canonical construction state**.

## 5. Construction Operating System (underlying layer)

The Digital Toolbag sits on the **SITEPM Construction Operating System**: canonical structured state; evidence/provenance; projects; tasks; field activity; documents; scheduling; estimating; costs; communications; people; business state; property state; construction knowledge; regulatory intelligence; permissions; workflows; historical outcomes; integrations; safe actions; agent/API platform.

As the OS becomes more capable, the Toolbag should become **easier**. OS complexity must not leak unnecessarily into field UX.

These are **not** assumed to be separate applications. AI Project Manager is the job-and-coordination capability **of this OS**, not a competing product with Digital Toolbag.

**As Above, So Below** (internal architecture principle only — **not** customer-facing positioning unless separately approved): the same core construction relationships should remain intelligible as SITEPM moves through scales, without a disconnected architecture at each level.

```
COMPONENT → ASSEMBLY → ROOM / AREA → BUILDING → PROPERTY
TASK → ACTIVITY → PROJECT → MULTIPLE PROJECTS → COMPANY / PORTFOLIO
WORKER → CREW → FOREMAN → SUPERINTENDENT / PM → OPERATIONS → COMPANY
MATERIAL REQUIREMENT → PURCHASE → INSTALLATION → COST → PROJECT ECONOMICS → COMPANY PERFORMANCE
FIELD OBSERVATION → EVIDENCE → ISSUE → PROJECT CONSEQUENCE → HISTORICAL OUTCOME → FUTURE INTELLIGENCE
```

| Domain | Role |
| --- | --- |
| SITEPM Operations | Projects, tasks, scheduling, field, documents, procurement, coordination, client communication, execution |
| SITEPM Office | Admin workflows, recurring obligations, vendor/sub administration, communications, future receptionist |
| SITEPM People | Roles, skills, qualifications, certifications, availability, labor/time/cost codes, workforce intelligence |
| SITEPM Business | Estimate-vs-actual, profitability, margin leakage, billing/cash visibility, capacity, management intelligence |
| SITEPM Growth / Acquire | Lead intelligence, market analysis, acquisition, marketing attribution, bid/no-bid, proposals, win/loss, pricing |
| SITEPM Property | Living Property Record produced progressively from construction activity |
| SITEPM Intelligence | Cross-cutting intelligence |
| SITEPM Estimate | Conversational calculation, takeoff, estimating, pricing, estimate-vs-actual learning |
| Digital Toolbag | Builder-facing capability/interaction layer across domains |

Earlier surface names (Projects, Field, Intelligence, Estimate, Property, Service, Agent/API) map into these domains. **Pocket Handyman**, **SITEPM Field / Tool Belt**, and **Construction Skill Graph** are not dropped; they are absorbed as Toolbag / People / knowledge-direction labels, not discarded opportunities.

## 6. Voice-first / vehicle-first interaction (long-term)

Voice is not merely speech-to-text. It is a major interaction architecture. Users are often driving, in trucks, walking sites, at suppliers, carrying materials, wearing gloves, away from desks, running multiple jobs.

Common workflows should not require deep menu navigation when they can be done naturally by voice. Example: a spoken Maple Street recap should eventually become daily log, progress, labor, material need, procurement task, schedule issue, blocker, trade follow-up, inspection risk, and evidence — without Projects → Field → New Log → Form. The builder described what happened; SITEPM determines where it belongs.

Voice works both ways (“What’s going on today?” → blockers, schedule, suppliers, callbacks, inspections, unfinished estimates, client decisions, tasks — then offer authorized actions).

Not in Ask Stage 3.

## 7. Natural construction input → structured construction state

Major principle. Builders should interact through behaviors already natural to construction: **speak, show, photograph, measure, point, listen, confirm.**

Canonical pipeline (long-term):

```
BUILD
  → SPEAK / SHOW / MEASURE
  → CAPTURE
  → PRESERVE SOURCE
  → UNDERSTAND
  → STRUCTURE
  → PROFESSIONALIZE
  → CONNECT TO PROJECT CONTEXT
  → IDENTIFY CONSEQUENCES
  → PROPOSE ACTIONS
  → AUTHORIZE
  → ACT
  → UPDATE CANONICAL STATE
  → LEARN
```

Also: voice / photo / measurement / email / document / field activity → structured state.

The human describes construction reality. SITEPM determines how **authorized** portions of that reality should be represented digitally. The builder does not write the daily report, build the spreadsheet takeoff, know how to create a PO or RFI, or know which PM module contains a delay. They describe the day, supply scope/measurements/photos, explain what material is needed, photograph the discrepancy, or say “The pump truck was two hours late.” SITEPM maps that to documentation, schedule, labor, vendor performance, cost, follow-up, and history **without** treating retrieved text as instructions or authorization.

Do not re-enter the same job into multiple modules. Raw source evidence stays distinct from derived interpretation. Consequential actions stay authorized.

## 8. Same authorized state — different interfaces

Contractors/builders and professional PM/office users often think differently and may need **different interfaces over the same authorized canonical state**. Do not create information silos per maturity level or persona.

Field: voice, camera, measurements, drawings, short questions, simple actions, concise answers, large controls, minimal navigation — like using a tool.

Office/PM: dashboards, tables, calendars, reports, forms, financial views, administrative controls.

Do not force both into one interaction model.

Example — one field statement, several authorized representations (not five competing truths):

- Worker: “The pump truck was two hours late.”
- PM: “Concrete placement delayed two hours due to pump supplier.”
- Owner: “Pump-related delays have cost approximately X labor hours across Y projects.”
- Estimator: “Historical concrete placements involving this supplier show higher delay variance.”

The worker should not need to understand how the information propagates.

Preserve:

```
SOURCE → FACT → DERIVATION → PRESENTATION
```

A professionally trained PM who understands CPM, procurement, budgets, contracts, documentation, and risk — but may have little hands-on trade experience — should receive useful construction intelligence **without SITEPM pretending they possess field expertise they do not have**. A highly capable carpenter should obtain digital leverage **without being required to become a PM**. Construction knowledge flows both ways: Field ↔ Management, Design ↔ Field, Client ↔ Contractor, Company ↔ Worker, Craft ↔ PM, Project ↔ Property. SITEPM should help preserve meaning as information crosses those boundaries.

## 9. Buyers, contractor maturity, and Construction Spectrum

**Contradiction resolved:** `SITEPM_BUILD_SPEC.md` §2 listed small/midsize residential GCs (~$2M–$30M, small PM teams) as initial customers. That segment remains important for Contractor #1 / MVP. It is **not** the only buyer.

**Solo builders and individual tradespeople are first-class potential paying customers** (carpenter, fence builder, handyman, painter, tile setter, concrete, installer, remodeler, landscaper, sub, specialty trade, one-person business). Some may never need traditional PM software and may still pay for calculate / estimate / identify / price / quote / communicate / requirements / schedule / purchase / document / invoice / profitability.

Distinguish **BUYER** from **USER**. A contractor may currently be performing physical work, running a one-person business, supervising a helper, managing a crew, running several projects, employing PMs/supers/estimators/admin, or operating a larger construction organization. These are **not** necessarily different markets. They can be stages of the **same** builder and business.

**SITEPM scales with the builder, not away from the builder.** The user should not outgrow SITEPM as the business grows. Experience should **deepen** (permissions, workflows, volume, financial and historical intelligence) rather than merely become more complicated or force a platform migration.

**Architectural span ≠ MVP scope.** Architecture may span individual workers through sophisticated organizations, clients/property owners, property lifecycle, and external agents. That does **not** mean acquiring all of those users at once or selecting extra MVP features from this map. The residential / small-growing contractor remains an important initial validation and MVP segment. Solo tradespeople remain first-class potential paying customers and should be **separately validated**. Do not create pricing tiers from this section.

### Contractor maturity / product depth (not pricing, not separate products, not MVP)

These are depths of **one** construction intelligence system.

| Level | Typical user | Primary SITEPM value | Example |
| --- | --- | --- | --- |
| 1 Builder / field worker | Tradesperson, carpenter, concrete, installer, foreman | Digital Toolbag + jobsite assistance | “How many bags of concrete do I need for this?” |
| 2 Solo contractor | One-person business wearing owner/sales/estimator/PM/super/trade/purchaser/admin/AR at once | Digital Toolbag + AI Project Manager | “Price this fence and write me a quote.” |
| 3 Small crew | Owner + helpers, employees, and/or subcontractors | AI Project Manager + Field-to-Office Pipeline | “We poured eight yards today, the pump was an hour late and I need two guys tomorrow.” |
| 4 Growing contractor | Multiple crews and/or simultaneous projects; office/PM beginning to separate from field | AI Project Manager + Construction OS | “Which jobs are behind and what needs my attention today?” |
| 5 Established contractor | PMs, supers, estimators, office/admin, specialized roles | Construction OS + Intelligence | “Where are we consistently losing margin on concrete work?” |
| 6 Construction organization | Larger structure, many users, concurrent projects | System of record + intelligence + controlled agent/API | “Compare estimated versus actual concrete productivity across crews, project types and regions.” |

Do **not** architect these as six unrelated products.

### Solo contractor as the Toolbag ↔ AI PM bridge

The solo contractor is simultaneously builder + estimator + PM + superintendent + purchaser + salesperson + administrator + business owner. SITEPM must **not** force that person to operate eight enterprise modules. Natural intents: Price this. Send this. Order this. Schedule Joe. Document this. What do I need to do tomorrow? Did I make money on this job? SITEPM maps those into authorized underlying systems. That is why Digital Toolbag and AI Project Manager are **not competing product concepts**.

### Construction Spectrum

Builder-first must **not** mean field-worker-only. Construction contains many forms of expertise — tradespeople, craftspeople, laborers, foremen, supers, PMs, estimators, schedulers, architects/designers, engineers, subcontractors, suppliers/manufacturers, inspectors, administrators, owners/developers, sophisticated organizations, homeowners/clients. None of these people are inherently “above” or “below” another. They possess **different** knowledge. SITEPM’s opportunity is partly to **connect** those forms of knowledge.

Long-term span (not launch TAM): individual tool use → field execution → crew coordination → project management → business operations → multi-project management → property intelligence → organizational intelligence → controlled agent/API infrastructure. Do not create artificial ceilings that later prevent movement **upward or downward** through the construction ecosystem.

### Client / non-construction participant (future surface, not MVP)

A technically sophisticated homeowner or client may understand another complex field well while knowing little about materials, structural terminology, permitting, realistic cost, scope, sequencing, contractor language, what to ask, how to read a proposal, or what the contractor needs. A future interface may help translate client intent into construction context and construction reality back to the client. This does **not** expand the current MVP into a homeowner product. Pocket Handyman / Property remain future surfaces over the broader architecture.

## 10. Conversational estimating / takeoff / pricing (long-term)

Preserve SITEPM Estimate. A builder should eventually describe a job naturally (e.g. 85-foot six-foot redwood fence with demo, haul-off, PT posts, concrete, boards, one helper) and SITEPM should ask only necessary missing questions.

Potential capabilities: dimensions, quantities, takeoffs, waste, demo, disposal, concrete, lumber, fasteners, hardware, labor hours/burden, crew, equipment, subs, delivery, supplier pricing, location-sensitive cost where reliable, overhead, markup, margin, contingency, risk, taxes where applicable, estimate and quote generation.

Distinguish: contractor-specific history, current supplier/external data, calculated values, user-provided values, assumptions, general construction knowledge. Provenance required. Do not present uncertain assumptions as known facts.

Learning loop: MEASURE → TAKEOFF → ESTIMATE → PRICE → BID → BUILD → JOB COST → COMPARE ACTUAL → IMPROVE NEXT ESTIMATE. Contractor-specific production economics are strategically more valuable than generic arithmetic.

Not in current MVP.

## 11. End-to-end job flow (long-term, not now)

Conversation → missing scope → takeoff → labor/cost → economics → price → quote → communicate → acceptance → job created → schedule/availability → material/PO → supplier → tasks → customer updates → documentation → actuals → invoice → estimate-vs-actual → Property Record. **The user should not re-enter the same job into multiple modules.**

## 12. Communications / action layer (long-term)

Channels may include voice, phone, SMS, email, in-app, future messaging. A company-controlled business identity may be appropriate. Commodity send is not the moat; construction context + structured state + workflow + authorization + history is.

Consequential external actions (customer communication, orders, POs, schedule commitments, financial state, approvals, contractual commitments) require explicit permissions, confirmation, and audit. AI interpretation is not authorization.

## 13. Language-independent construction intelligence (long-term)

Expand the English↔Spanish field bridge:

**Work in your language. SITEPM maintains common construction meaning underneath.**

English-only users get the complete experience. Spanish-only users must also be capable of the complete experience. Bilingual is an advantage, not a prerequisite.

Language is **one part of the Builder–Technology Gap**, not the whole problem. A native-English builder who has never opened Word is in the same architectural class as a Spanish-only builder: construction intelligence without requiring conventional digital literacy.

Not literal translation: preserve construction meaning, terminology, and context. Do **not** create separate English and Spanish project truth. Language is an interface/presentation layer over common authorized structured state. Original language is retained as evidence.

**Translation beyond human language.** SITEPM translation is not only Spanish ↔ English. It can eventually include translation between forms of construction understanding: field language ↔ professional PM language; craft knowledge ↔ structured project data; drawing/specification ↔ field instruction; field condition ↔ RFI / issue / change workflow; client intent ↔ construction scope; estimate ↔ execution plan; field actuals ↔ management intelligence; project history ↔ future estimate; technical information ↔ appropriate user explanation.

The objective is **not** to remove specialized expertise. It is to reduce information loss between specialists.

Ask V1 Stage 3 is not required to ship this.

## 14. Field-native personality (long-term)

The assistant may be concise, practical, confident, construction-literate, conversational, with restrained humor — never a caricature of a tradesperson. Context-aware: client proposals, contracts, code/regulatory, safety, and financial outputs become professional and precise. Personality must never reduce factual reliability or obscure uncertainty.

## 15. Customer economic outcomes (measure later)

**Time saved:** less admin, duplicate entry, searching; automated documentation; faster estimating; less office load.  
**Money saved:** less rework, missed scope, coordination/schedule failure, margin leakage, purchasing mistakes, unnecessary overhead.  
**Money made:** faster estimates, better lead/bid response, change-order capture, profitable-work identification, capacity, acquisition, pricing, revenue/margins.

These are outcomes to **measure and substantiate**, not current marketing claims.

## 16. Naming / brand (research input only)

SITEPM may remain the development/internal name while commercial naming is evaluated. Do **not** rename the repository or product from this file. Naming must account for tool-in-the-toolbag, not merely PM software: practical, field-native, approachable to a solo tradesperson, credible for a growing contractor. Test phrases like “Ask ____,” “Check it in ____,” “Run it through ____,” “Put it in ____.” Avoid defaulting to enterprise-SaaS labels because the OS is sophisticated. Do not alienate the excellent builder who dislikes computers.

## 17. Opportunity map — not in MVP does not mean dropped

Preserve: estimating/preconstruction; scheduling; timeclock/time tracking; cost codes; job costing; field logs; tasks; documents; client reports/communication; procurement; change orders; payments/billing visibility; compliance; permitting; Construction Knowledge; Regulatory Intelligence; English↔Spanish construction bridge; translation beyond human language; photo intelligence; 360-camera intelligence; progress/quality/install evidence; before/after and design visualization; closeout; warranties; installed products; Living Property Record; homeowner/property intelligence; client/non-construction participant (future); service/maintenance; Acquire/Growth; market intelligence; lead acquisition; marketing attribution; bid/win-loss; pricing intelligence; People/workforce; Office/admin; phone/email/reception; agent/API platform; Digital Toolbag; AI Project Manager; conversational estimating; material identification; construction calculations; voice-first operation; Field-to-Office Pipeline; two-way field intelligence; Jobsite Copilot / field assistance; field knowledge extraction; contractor maturity / product depth; Construction Spectrum; physical AI/robotics as previously documented (SITEPM does not build robots now).

## 18. Knowledge classes (interoperable, not interchangeable)

Language (English/Spanish construction-aware interpretation) operates **across** these classes. Language is not a separate source of truth.

| Class | What it is | Privacy default | Ask SITEPM V1 |
| --- | --- | --- | --- |
| **Project Knowledge** | This job: projects, tasks, field logs, documents; later photos, RFIs, submittals, decisions | Class B tenant-private | **In scope** |
| **Property Knowledge** | What physically exists at a particular property: installed components, finishes, concealed conditions, service/replacement history | Class C when authorized to outlive a job; otherwise Class B | Out of scope |
| **Company Knowledge** | SOPs, historical jobs, preferred details, internal lessons, approved vendors/trades | Class B | Out of scope except incidental project fields already stored |
| **Construction Knowledge** | General U.S. building/trade intelligence (methods, materials, failure modes, diagnostics) | Class A only with verified license/terms; never mix with tenant jobs | Out of scope |
| **Regulatory Knowledge** | Jurisdiction- and edition-specific requirements | Distinct from Construction Knowledge; licensed/cited per jurisdiction | Out of scope |

Do not collapse these into one generic “SITEPM knows construction” answer. A project fact, a property fact, a trade practice, and a code citation are different claims.

## 19. Evidence-first intelligence

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

Role-appropriate interfaces present authorized views or derivations of that evidence-backed state. They must not create competing versions of truth. Chain:

```
SOURCE → FACT → DERIVATION → PRESENTATION
```

## 20. Living Property Record (long-term, not schema now)

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

## 21. Construction document intelligence (long-term)

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

## 22. SITEPM Construction Knowledge (long-term, Class A)

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

## 23. Regulatory / jurisdiction knowledge (long-term, distinct)

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

## 24. English / Spanish construction field bridge (detail)

Canonical principle: §13. **Not** generic UI translation. Eventually: English superintendent/PM ↔ Spanish field communication; trade terminology; project-context-aware interpretation; questions against drawings/specs/property records in either language; structured issues from spoken/typed field descriptions; original language preserved as evidence. Do not assume one Spanish dialect. Ask SITEPM V1 Stage 3 is not required to ship this.

## 25. Long-term product family (maps into OS domains)

Canonical domains: §5. These share one construction/property data layer. They are not current implementation tasks.

| Surface | Role |
| --- | --- |
| SITEPM Projects | PM, tasks, coordination, documents, field information |
| SITEPM Field | Voice-first capture, photo/video, daily logs, issues, safety, bilingual field bridge, field-to-office reporting |
| SITEPM Intelligence | Plans/spec understanding, RFI/submittal/CO comparison, change and risk detection, briefings, decision history, evidenced Q&A across knowledge classes |
| SITEPM Estimate | Contractor-specific cost intelligence from estimate vs actual (Class B only by default) |
| SITEPM Property | Permanent building/property record after construction |
| SITEPM Service | Warranty, maintenance, service history, installed-product intelligence |
| SITEPM Agent/API | Identity, permissions, APIs, tool interfaces, controlled access for agents and external software |

## 26. Construction Graph (conceptual)

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

## 27. Field-to-Office Pipeline, two-way field intelligence, and Jobsite Copilot (future)

**Do not make the field report to the software. Let the field talk about the work. SITEPM builds the report and the structured project state.**

The polished report is **not** the end product. It is one human-readable output of a larger structured intelligence pipeline.

### Field-to-Office Pipeline

Example: at the end of the day a concrete worker in the truck presses one obvious button and talks for two minutes — who worked, start time, what was accomplished, quantities, what went well/wrong, delays, unexpected conditions, materials and labor for tomorrow, unresolved issues. They may speak English, Spanish, or another future supported language. They may have extremely low computer literacy. Neither should block the workflow.

SITEPM should eventually: (1) preserve original voice/transcript as source evidence; (2) interpret construction meaning; (3) extract candidate structured facts; (4) distinguish facts from inference; (5) produce polished professional documentation; (6) identify operational consequences; (7) propose downstream actions; (8) obtain required authorization; (9) update appropriate project state; (10) contribute historical information.

Candidate structured outputs: crew; labor/time; work performed; production quantity; percent/progress; materials used/required; delays; vendor/sub performance; concealed conditions; quality observations; unresolved work; tomorrow’s requirements; schedule risk; cost risk; follow-up.

Downstream (authorized): Field Logs, Tasks, scheduling, procurement, crew planning, vendor/sub follow-up, issue tracking, PM/client communication, change-condition review, cost tracking, project history, Property Record where relevant.

The live Field Logs MVP stays notes, date, issue flag, project association. This pipeline is not the next Field PR and not Ask Stage 3.

### Two-way field intelligence

**Pipeline A — Field → SITEPM → Project:** the field continuously improves project state.

**Pipeline B — Project + Construction Knowledge → SITEPM → Field:** project state and construction knowledge continuously improve field execution.

Field questions (future): What is this? How do I install this? Find the manual. What size? Help me lay this out. Calculate this. What does this detail mean? Does this match the drawing? What should happen next? Do I need to stop and call my supervisor?

Assistance may use authorized project context, plans, specs, manuals, product information, measurements, previous job history, Construction Knowledge, and Regulatory Intelligence. Ask remains one interface; this architecture must not weaken project authorization, tenant isolation, evidence/provenance, source-trust distinctions, or AI ≠ authorization.

### Jobsite Copilot / field assistance

Preserve the opportunity to help a worker accomplish work when immediate supervision is unavailable (skilled-labor constraints, uneven experience, limited supervision, language barriers, specialized products, fragmented knowledge). Do **not** claim all labor segments will experience identical shortages.

Durable opportunity: **SITEPM can increase the effective capability of people already on the jobsite.**

SITEPM must **not** become an unsafe substitute for licensed professionals, engineers, qualified supervision, inspectors, manufacturer requirements, safety procedures, or professional judgment.

Distinguish **informing, calculating, retrieving, explaining, documenting, identifying discrepancies, suggesting checks** from **authorizing, overriding requirements, making licensed/engineering decisions, or making unsafe assumptions.** When escalation is required, make it easy.

Example: “This does not appear to match Detail 4/A6.2. Don’t assume the difference is intentional. I can document what you’re seeing and send it to your superintendent for clarification.”

### Field knowledge extraction as data strategy

Valuable construction information often exists only in workers’ heads and disappears because conventional software makes capture too hard. SITEPM should dramatically reduce that friction. A two-minute field conversation may contain production, labor, material consumption/requirements, delays, supplier/sub performance, concealed conditions, quality, sequencing, schedule/cost risk, lessons, and tomorrow’s needs.

```
FIELD EXPERIENCE
  → STRUCTURED PROJECT HISTORY
  → COMPANY KNOWLEDGE
  → BETTER ESTIMATING
  → BETTER PLANNING
  → BETTER FIELD ASSISTANCE
  → BETTER FUTURE PROJECTS
```

The moat is **not** voice transcription or report generation. The strategic asset is accumulated, permissioned, provenance-aware construction state and historical operational intelligence produced from real work (Class B; Class D only if later authorized).

## 28. Change intelligence (future)

Compare plan revisions, specifications, RFIs, submittals, change orders, field conditions, and schedule/cost implications.

SITEPM should eventually answer: what changed, why, what it affects, who approved it, and what evidence supports that conclusion. Not implemented now.

## 29. Cost and estimating memory (future)

Learn from **authorized contractor history only** (see also §10 conversational estimating):

estimate → actual labor → actual material → subcontractor cost → change orders → schedule impact → final outcome

Do not pool tenant-private cost data across customers. Cross-tenant intelligence requires Class D authorization.

## 30. Closeout / warranty intelligence (future)

A permanent closeout record should outlive project completion when Class C is authorized: installed products, manufacturer/model/serial, location, trade, installation date, photos, manuals, warranties, receipts/invoices, approved submittals, service events, repair history.

## 31. SITEPM Ingest / API layer (future)

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

## 32. AI / model strategy

SITEPM’s moat must not depend on one AI model. Models remain replaceable (including the build spec’s current OpenAI mention for V1).

Long-term defensibility comes from structured data, history, ontology, provenance, permissions, workflows, integrations, field evidence, governed proprietary knowledge, agent APIs, and **field knowledge extracted into project/company history** — not from a particular model vendor and not from transcription or report generation alone.

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

## 33. Physical AI / robotics (long term)

Drones, robotic inspection, automated capture, sensors, and physical AI may consume SITEPM property/building context. SITEPM provides structured environmental memory. SITEPM does not build robotics now.

## 34. Data ownership / privacy classes

| Class | Meaning | Default |
| --- | --- | --- |
| A | External construction/reference knowledge | Reuse only with verified license |
| B | Tenant-private project/company data | Never pooled, sold, or used cross-tenant |
| C | Authorized property/building history | Owner/contract scoped; survives project closeout only with authorization |
| D | Appropriately permitted / de-identified aggregated intelligence | Requires contractual, privacy, security, and legal authorization |

Tenant isolation is foundational. Publicly viewable does not mean reusable.

## 35. Data / product flywheel

```
External Construction Knowledge (Class A, licensed)
  → SITEPM Knowledge Foundation
  → Contractor Projects (Class B)
  → Field experience captured with low friction
  → Structured project history / company knowledge
  → Real-World Execution Data
  → Property History (Class C)
  → Better estimating, planning, field assistance
  → Better Construction Intelligence
  → More Useful Products/APIs
  → More Customers/Data
```

Constrained at every step by privacy, contracts, provenance, licensing, and RLS. Regulatory Knowledge joins this flywheel only as cited, editioned sources — not as unlabeled “best practice.”

## 36. Future research / data-acquisition work

Not started. Do not claim datasets or code-licensing rights.

Research tracks (see `docs/DATA_SOURCE_REGISTRY.md`):

- U.S. plan and construction-document format diversity (without adopting BIM as the product)
- California-first, then national, **regulatory** source licensing (distinct from trade knowledge)
- Class A construction datasets, government publications, manufacturer docs, educational and licensed expert content
- Whether and how Class D anonymized SITEPM history could ever be authorized
- Construction Spanish/English terminology variation (not a single dialect dictionary assumed to be complete)
- Mapping SITEPM’s own ontology to IFC/CSI only after license review

## 37. Immediate next product work

**Ask SITEPM V1 Stage 3** (when separately authorized): replaceable model + epistemic answers + allowlist-validated citations over Stage 2 project-scoped evidence. Stage 4 remains PDF intelligence.

**Do not start Ask Stage 3 from this document.** Do not implement the property schema, Digital Toolbag runtime, voice OS, Field-to-Office Pipeline, Jobsite Copilot, estimating, communications, contractor-maturity product lines, or client/homeowner surfaces. Architecture breadth is not MVP breadth. Do not change existing RLS from this document.

Long-term design tests (not V1 gates): Field Test (low digital literacy, useful immediately); Word Test; Solo Contractor Test (multiple roles, no software silos); PM Test (management expertise without pretending field craft); Project-Management Test (less manual collect/structure/chase); Client Test (intent without pretending construction expertise); Translation Test (meaning across expertise); Growth Test (more useful as the contractor grows); Scale Test (one worker/task through many projects/organization); System Test (same authorized state, not disconnected products); Truth Test (views/derivations of one evidence-backed state); Moat Test (permissioned history improving future outcomes); Truck Test (§4).
