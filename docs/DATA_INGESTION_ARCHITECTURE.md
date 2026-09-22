# SITEPM Data Ingestion Architecture

Status: conceptual. No ingestion pipeline, property schema, or external corpus is implemented in this pass.

Related: `docs/PRODUCT_ARCHITECTURE.md`, `docs/DATA_SOURCE_REGISTRY.md`.

Accepted first-party capture today is **application writes under RLS** (projects, tasks, field logs, document PDFs). That is not a general ingest platform.

## 1. Canonical pipeline

```
Sources
  → Ingestion
  → Raw Evidence
  → Extraction
  → Normalization
  → Entity Resolution
  → Construction Graph (Postgres)
  → Historical Memory
  → APIs / Agents / Products
```

Preserve original evidence whenever feasible. Structured facts point back to evidence; they do not replace it.

Every derived claim should be storable as:

```
claim → evidence → source → version/date → project/property context
```

Tag the claim’s knowledge class (Project, Property, Company, Construction, Regulatory) and its epistemic kind (documented fact, derived inference, general knowledge, uncertainty).

## 2. First-party sources (current and planned)

| Source | Status | Notes |
| --- | --- | --- |
| SITEPM Projects | Live | Company-scoped; `projects` table; address is a string, not a Property node |
| Tasks | Live | Inherit company via parent project + RLS |
| Field Logs | Live | Notes, date, issue flag; photos later |
| Documents (PDF) | Live | Private Storage; pending → ready \| failed; opaque bytes until document intelligence |
| Photos/video | Not live | Spec Week 9; store as evidence, including concealed-condition photos |
| Plans/specifications intelligence | Not live | Extraction later; originals already stored as documents |
| RFIs / submittals / change orders | Not live | Intelligence later |
| Estimates / invoices / receipts | Not live | Class B; never cross-tenant by default |
| Accounting / email integrations | Not live | Ingest API later |
| Manufacturer information | External Class A | Registry; licensing first; tenant-uploaded manuals are Class B evidence |
| Service records | Not live | Property/Service surfaces |
| Sensors / building systems | Long-term | Physical AI extension |
| Bilingual field utterances | Not live | Retain original language as evidence; interpretation is derived |

## 3. Knowledge-class ingest (future)

Do not mix pipelines so that a code edition, a trade practice, and a job photo become one undifferentiated embedding corpus.

| Knowledge class | Typical sources | Isolation |
| --- | --- | --- |
| Project | SITEPM writes, tenant uploads, later job integrations | Class B; company + project RLS |
| Property | Closeout packages, as-builts, installed-product evidence | Class B until Class C authorization exists |
| Company | SOPs, preferred details, vendor lists | Class B; company RLS |
| Construction | Licensed/open U.S. trade and educational material; CA-deep then national | Class A; never tenant-pooled |
| Regulatory | Jurisdiction + edition + amendment + effective dates | Separate from Construction Knowledge; cite applicability to a project, do not merge editions |

Language overlay: English/Spanish interpretation may run on Project or Property evidence. Store original text/audio; do not treat a translation as the only record.

## 4. Construction document intelligence (future)

Target: extract structured building information from many U.S. plan and construction-document formats while keeping the original file.

Example derived structure (not a table to create now):

```
Door D-14 → room/area → hardware set → manufacturer/model/finish
         → source document / sheet / page / detail / revision
```

BIM/IFC may inform **relationship vocabulary**. Do not ingest IFC as if SITEPM were a BIM host. Do not copy CSI/OmniClass tables into SITEPM without a software license (see registry).

Failed or pending document rows are not evidence for intelligence; only retained originals that the product treats as ready (or an explicit later evidence type).

## 5. Raw evidence

An evidence record should keep:

- bytes or storage path (photo, PDF, audio, video, email MIME)
- media type
- original language when the capture is linguistic
- capture or upload time
- capturing user / agent identity
- company_id and project_id (or property_id when that class exists)
- device/client metadata when available
- checksum
- retention class

Do not overwrite originals. Corrections are new evidence plus a later fact version. Document Storage today already denies authenticated UPDATE/DELETE of objects; that direction is consistent with immutable originals.

## 6. Extraction and normalization

Extraction turns evidence into candidate facts (entities, events, quantities, locations, products, concealed conditions).

Normalization maps those candidates onto SITEPM vocabulary (status enums, trade names, product identifiers, locations). SITEPM’s vocabulary is owned by SITEPM; external schemas are mappings, not the database.

Entity resolution links “184 Maple Isolation Job”, an address string, and a future Property node without silently merging tenants or jurisdictions.

## 7. Provenance

Every structured fact should retain:

```
SOURCE → FACT → DERIVATION → PRESENTATION
FACT
  → derived_from → EVIDENCE
  → originated_from → SOURCE
```

Example: Installed Product supported by approved submittal, invoice, field photo, and installer confirmation.

Record at minimum:

- source identifier
- retrieval or creation timestamp
- source version / document revision / code edition
- jurisdiction when regulatory
- confidence
- verification state
- transformation history where appropriate (including interpretation from Spanish ↔ English)

SITEPM Intelligence must not present inference as documented fact, or Construction Knowledge as Project Knowledge.

## 8. Field-to-Office Pipeline (future)

Canonical concept: **Field-to-Office**. Do not make the field report to the software. Let the field talk about the work.

```
voice | text | photo | video | measurement | email | document | form | sensor
  → preserve source (original language / audio)
  → interpret construction meaning
  → candidate structured facts (distinct from inference)
  → professionalize human-readable outputs
  → identify consequences / propose authorized actions
  → update canonical project state
  → historical / company knowledge (Class B)
```

Capture once; reuse across Field Logs, Tasks, schedule, procurement, and later Property. Two-way: Field → Project and Project + Construction Knowledge → Field. The live Field Logs feature stays small. This pipeline is the target shape, not the next Field PR and not Ask Stage 4.

## 9. Ingest API (future)

External software posts evidence and/or already-structured records:

```
External construction software
  → SITEPM Ingest API
  → authN / authZ / tenant / project (later property) scope
  → raw store
  → optional extract/normalize
  → Postgres graph
```

Sensitive writes (costs, contracts, external messages) keep human approval from the build spec.

## 10. What not to do now

- No new tables solely for this architecture (including property/component/ontology tables)
- No scraping or bulk download of external datasets
- No service-role in the browser
- No weakening of RLS
- No pooling of Class B data
- No assuming public web pages are licensed for training or product reuse
- No collapsing California and other jurisdictions into one code blob
- No Ask SITEPM Stage 3 (or later) from this file
