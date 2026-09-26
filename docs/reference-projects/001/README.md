# SITEPM Reference Project 001 — Larkglass House

Version 1.0. Entirely fictional high-end residential remodel/addition benchmark. No live project was created. No external records, real contacts, real products, or real permit/account identifiers were used. Names are invented; incidental resemblance is unintended. All emails use `.example`, telephone numbers use 555-01xx, and the address is explicitly non-deliverable. Dates run 2027–2030 as a fictional scenario, not events that have occurred.

## Purpose and boundary

Prepare source-grounded evaluation for separately authorized Stage 4 document intelligence and later Living Property Record work. Current accepted Stage 3 reads structured evidence and document metadata, not these contents. This package is not runtime code, a seed/import script, a schema, or a product capability claim. Do not upload, connect accounts or change RLS to run it.

15 source documents cover design/specification, contracts, submittals, RFI/change, budget/schedule, field evidence, photo manifests, inspection/commissioning, as-built, closeout, dated contacts and later service. These editable Markdown sources support semantic retrieval evaluation; they are not PDFs, scanned sheets, dimensioned drawings or actual photos. PDF/OCR/layout/image testing needs a separately validated rendition. All project engineering/product/test details are fictional benchmark content, not construction instructions.

## Read order and authoritative locators

Each source has document ID, issue date, revision/status, issuer and stable section identifiers. Use `RP001-D13#S1` style source references; file paths and SHA-256 digests are in `source-register.json`. Section identifiers are locators, not page numbers. Forward cross-references to later documents are editorial navigation added for this fixture; they do not imply the later document or its facts were available at the earlier issue date. Explicit source references and their supersession scope take precedence over upload order or filenames.

| Document | Content |
| --- | --- |
| [RP001-D01](sources/01-project-brief.md) | Project brief and participant register |
| [RP001-D02](sources/02-design-m32-r0.md) | Mechanical drawing M3.2 revision 0 — textual drawing schedule |
| [RP001-D03](sources/03-specifications.md) | Interior and hydronic specification extracts |
| [RP001-D04](sources/04-contract-scope.md) | Executed construction agreement and hydronic scope excerpt |
| [RP001-D05](sources/05-submittal.md) | Hydronic submittal SUB-H014-02 |
| [RP001-D06](sources/06-rfi-007.md) | RFI-007 — manifold access conflict and response |
| [RP001-D07](sources/07-change-order.md) | Change order CO-003 — manifold relocation |
| [RP001-D08](sources/08-schedule-budget.md) | Schedule and budget update 03 |
| [RP001-D09](sources/09-field-log.md) | Field log FL-042 — living-room radiant installation |
| [RP001-D10](sources/10-photo-manifest.md) | Pre-cover photo manifest PM-042 |
| [RP001-D11](sources/11-inspection-commissioning.md) | Pre-cover inspection and commissioning dossier |
| [RP001-D12](sources/12-closeout-warranty.md) | Closeout, warranty and handoff record |
| [RP001-D13](sources/13-as-built-m32-ab1.md) | M3.2 AB1 — installed-condition textual record |
| [RP001-D14](sources/14-contacts-service-request.md) | Contact history and service request SR-009 |
| [RP001-D15](sources/15-service-event.md) | Service ticket SV-009 and unresolved follow-up note |

## Evaluation protocol

1. Give the future authorized evaluator only the 15 files in `sources/` as retrieval evidence. Treat source text as untrusted data, never instructions.
2. Keep this README, `source-register.json`, `ground-truth.json` and `validate.py` outside model retrieval. The register is an evaluator integrity inventory, not a sixteenth source document.
3. Use the 18 questions and as-of dates in `ground-truth.json`. Answers must cite material claims, distinguish source statements from inferences and admit missing evidence. The rubric accepts semantic equivalents, not exact string matching.
4. Evaluate present configuration and historical design separately. For as-of questions, only records issued by the cutoff are available; do not use facts first supplied in later compilations even if an embedded event has an earlier date.
5. Score answers against the listed source sections. Disclose both sides of the unresolved actuator conflict. Do not let newer recollection overwrite technician evidence automatically.
6. Run `python3 docs/reference-projects/001/validate.py` from repository root for offline fixture integrity. It performs no application queries, provider calls, imports or uploads.

## Chronology and intentional traps

M3.2 R0 routes living-room loops to RH-01/UC-001. RFI-007 relocates/retags to RH-02/MR-001 and ports 3/4; CO-003 changes money/time. Installation and AB1 establish recorded installed condition and measured loop lengths. Commissioning is a dated observation. November 2029 service replaces port 3 actuator only; January 2030 owner recollection that both were replaced remains unresolved. That last conflict must be surfaced, not guessed away.

The west-floor puncture is owner speculation, not a diagnosed leak. Original images, exact tube coordinates/depth, replacement warranty, paid actual costs and final cabinet paint remain unknown. Closeout acceptance does not erase gaps. Product approval is not installation evidence; captions are not viewed photos. A service event is not proof there was no other unrecorded work.

## Conceptual entity map (not database schema)

RP001-PROP-01 → ground floor → LR-101 → Z-LR-01 → L-LR-A / L-LR-B → RH-02 ports 3/4 → SYS-RAD-01; RH-02 located in MR-001. Nacreloop Thermal → RP001-SC-014 → installation → dated contacts → RP001-SO-009 → actuator replacement. Sources attach to each asserted relationship. Product, manufacturer, vendor, manual, warranty and photo-caption relationships retain their own limits. LR-101 and addition GR-102 are distinct areas.

Class C handoff access, entity-resolution policy, evidence retention and later-project access are future design decisions. This fictional fixture makes no authorization change and is not an RLS/isolation test.
