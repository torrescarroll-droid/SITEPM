# SITEPM Data Ingestion Architecture

Status: conceptual. No ingestion pipeline is implemented in this pass.

Related: `docs/PRODUCT_ARCHITECTURE.md`, `docs/DATA_SOURCE_REGISTRY.md`.

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

## 2. First-party sources (current and planned)

| Source | Status | Notes |
| --- | --- | --- |
| SITEPM Projects | Live | Company-scoped; `projects` table |
| Tasks | Live | Inherit company via parent project + RLS |
| Field Logs | Table exists; UI demo | Next implementation milestone |
| Photos/video | Not live | Spec Week 9; store as evidence, not only attachments |
| Plans/specifications | Not live | Documents milestone |
| RFIs / submittals / change orders | Not live | Intelligence later |
| Estimates / invoices / receipts | Not live | Class B; never cross-tenant by default |
| Accounting / email integrations | Not live | Ingest API later |
| Manufacturer information | External Class A | Registry; licensing first |
| Service records | Not live | Property/Service surfaces |
| Sensors / building systems | Long-term | Physical AI extension |

## 3. Raw evidence

An evidence record should keep:

- bytes or storage path (photo, PDF, audio, video, email MIME)
- media type
- capture or upload time
- capturing user / agent identity
- company_id and project_id (or property_id when that class exists)
- device/client metadata when available
- checksum
- retention class

Do not overwrite originals. Corrections are new evidence plus a later fact version.

## 4. Extraction and normalization

Extraction turns evidence into candidate facts (entities, events, quantities, locations).

Normalization maps those candidates onto SITEPM vocabulary (status enums, trade names, product identifiers, locations).

Entity resolution links “184 Maple Isolation Job”, an address string, and a future Property node without silently merging tenants.

## 5. Provenance

Every structured fact should retain:

```
FACT
  → derived_from → EVIDENCE
  → originated_from → SOURCE
```

Example: Installed Product supported by approved submittal, invoice, field photo, and installer confirmation.

Record at minimum:

- source identifier
- retrieval or creation timestamp
- source version
- confidence
- verification state
- transformation history where appropriate

Distinguish:

| Kind | Meaning |
| --- | --- |
| Observed fact | Directly recorded in SITEPM by an authorized user (task created, field log saved) |
| Extracted information | Pulled from evidence by software |
| Inference | Model or rule conclusion |
| User assertion | Human claim not yet evidenced |
| External reference | Class A knowledge with license and citation |

SITEPM Intelligence must not present inference as observed fact.

## 6. Field ingestion model (future)

```
voice | text | photo | video | document | form | sensor
  → evidence
  → extraction
  → project / task / location / material links
  → historical memory
```

The Field Logs MVP should stay small: notes, date, issue flag, project association, later photo. This pipeline is the target shape, not the first Field Logs PR.

## 7. Ingest API (future)

External software posts evidence and/or already-structured records:

```
External construction software
  → SITEPM Ingest API
  → authN / authZ / tenant / project scope
  → raw store
  → optional extract/normalize
  → Postgres graph
```

Sensitive writes (costs, contracts, external messages) keep human approval from the build spec.

## 8. What not to do now

- No new tables solely for this architecture
- No scraping or bulk download of external datasets
- No service-role in the browser
- No weakening of RLS
- No pooling of Class B data
