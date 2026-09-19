# SITEPM Data Source Registry

Status: registry of **candidate** sources. Validation status is `unverified` unless noted.

Publicly viewable does **not** mean reusable. Unknown licensing or access is marked **RESEARCH REQUIRED**. This pass did not scrape, bulk-download, or ingest any source.

Related: `docs/PRODUCT_ARCHITECTURE.md`, `docs/DATA_INGESTION_ARCHITECTURE.md`.

## Registry fields

- source/provider
- source category
- information available
- API/access mechanism
- licensing/reuse status
- geographic coverage
- update frequency/version
- applicable Construction Graph entities
- provenance requirements
- priority
- validation status
- notes/restrictions

Priority: `P0` near-term product, `P1` after Documents/Ask, `P2` later surfaces, `P3` research only.

## First-party (already in SITEPM)

| Field | Value |
| --- | --- |
| source/provider | SITEPM application (this repository) |
| source category | First-party operational data |
| information available | Companies, profiles, projects, tasks; field_logs table reserved |
| API/access mechanism | Next.js server + `@supabase/ssr`; authenticated PostgREST under RLS |
| licensing/reuse status | Class B tenant-private. Not reusable across tenants. |
| geographic coverage | Tenant-defined |
| update frequency/version | Live |
| applicable Construction Graph entities | Company, People, Projects, Tasks, (Field Events when live) |
| provenance requirements | Auth user, timestamps, company_id, project_id |
| priority | P0 |
| validation status | Accepted through Week 5 isolation tests |
| notes/restrictions | Do not export tenant data into Class A or Class D without authorization |

## External reference knowledge (Class A)

### buildingSMART IFC / openBIM schema

| Field | Value |
| --- | --- |
| source/provider | buildingSMART International |
| source category | Open construction standard / schema |
| information available | IFC object, property, and relationship schema; not a project dataset |
| API/access mechanism | Published documentation and schema files; not ingested here |
| licensing/reuse status | IFC 4.3 documentation is published under **CC BY-ND 4.0** (attribution; no sharing of adapted material). Trademarks and brand use have separate policy. Embedding IFC in a product still needs legal review. **RESEARCH REQUIRED** for SITEPM product use beyond reading the standard. |
| geographic coverage | Global |
| update frequency/version | Versioned (e.g. IFC4.3) |
| applicable Construction Graph entities | Plans, Assemblies, Components, Products, Locations |
| provenance requirements | Cite standard version |
| priority | P2 |
| validation status | Unverified for SITEPM reuse; license text not independently counsel-reviewed |
| notes/restrictions | bSDD dictionaries have **per-dictionary** licenses; do not assume IFC terms cover bSDD content |

### CSI OmniClass / MasterFormat / UniFormat

| Field | Value |
| --- | --- |
| source/provider | Construction Specifications Institute (CSI) |
| source category | Construction classification / dictionary |
| information available | Work results, elements, objects for specs, BIM, estimating |
| API/access mechanism | Licensed digital products / Dynamic Standards (commercial) |
| licensing/reuse status | **Not open.** CSI EULAs restrict incorporating classifications into commercial software without a software/firm license. **RESEARCH REQUIRED**; do not copy tables into SITEPM. |
| geographic coverage | Primarily North America |
| update frequency/version | Editioned; Dynamic Standards is subscription |
| applicable Construction Graph entities | Tasks, Materials, Specs, Costs, Products |
| provenance requirements | Licensed edition identifier |
| priority | P2 |
| validation status | Unverified; commercial license required for product embedding |
| notes/restrictions | Public PDFs online ≠ redistribution or API rights |

### buildingSMART Data Dictionary (bSDD)

| Field | Value |
| --- | --- |
| source/provider | buildingSMART International and contributing organizations |
| source category | Construction ontologies / dictionaries |
| information available | Classes and properties mapped to IFC |
| API/access mechanism | bSDD service/API (not called in this pass) |
| licensing/reuse status | **RESEARCH REQUIRED** per dictionary |
| geographic coverage | Global, mixed publishers |
| update frequency/version | Continuous per publisher |
| applicable Construction Graph entities | Products, Materials, Assemblies |
| provenance requirements | Dictionary id, version, publisher |
| priority | P2 |
| validation status | Unverified |
| notes/restrictions | Do not harvest without each publisher’s terms |

### Local government permit and inspection open data

| Field | Value |
| --- | --- |
| source/provider | Individual cities/counties (examples cataloged on data.gov: Philadelphia L&I, Austin issued permits, Wake County building permits, etc.) |
| source category | Government/public construction datasets |
| information available | Issued permits, inspections, violations; quality and schema vary |
| API/access mechanism | Socrata, ArcGIS, CSV, city-specific APIs |
| licensing/reuse status | **Per portal.** Open data license is not uniform. **RESEARCH REQUIRED** before any city is used. |
| geographic coverage | City/county only; no national unified feed |
| update frequency/version | Nightly to irregular |
| applicable Construction Graph entities | Projects, Properties, Inspections, Permits (future) |
| provenance requirements | Portal, dataset id, retrieved_at, record id |
| priority | P1 for contractor’s operating cities only |
| validation status | Unverified |
| notes/restrictions | Address-level records can be personal/commercial sensitive. Tenant isolation still applies if stored beside Class B data. Scraping city sites outside published APIs is out of policy. |

### Manufacturer product, spec, manual, and warranty data

| Field | Value |
| --- | --- |
| source/provider | Manufacturers and distributors |
| source category | Product information |
| information available | Model numbers, specs, manuals, warranties, SDS |
| API/access mechanism | Official APIs, licensed PIM feeds, or user-uploaded documents |
| licensing/reuse status | **RESEARCH REQUIRED.** Marketing sites are not a license to copy. Prefer manufacturer APIs or documents the tenant uploads (Class B evidence). |
| geographic coverage | Varies |
| update frequency/version | Product-line specific |
| applicable Construction Graph entities | Products, Manufacturers, Warranties, Documents |
| provenance requirements | Manufacturer, SKU, document version, retrieved_at |
| priority | P1 via tenant-uploaded manuals first; P2 commercial APIs |
| validation status | Unverified |
| notes/restrictions | Do not scrape manufacturer sites |

### Building codes and regulations

| Field | Value |
| --- | --- |
| source/provider | ICC, state/local amendments, AHJs |
| source category | Code/regulatory information |
| information available | Model codes and local amendments |
| API/access mechanism | Licensed code platforms; some jurisdictions publish locally |
| licensing/reuse status | **RESEARCH REQUIRED.** ICC content is typically copyrighted. Local amendments may differ. |
| geographic coverage | Jurisdiction-specific |
| update frequency/version | Code cycle |
| applicable Construction Graph entities | Inspections, Decisions, Specs |
| provenance requirements | Code edition, jurisdiction |
| priority | P2 |
| validation status | Unverified |
| notes/restrictions | Do not reproduce copyrighted code text in SITEPM without a license |

### Approved commercial construction APIs

| Field | Value |
| --- | --- |
| source/provider | Accounting, takeoff, project, and material platforms (to be named only after a commercial agreement) |
| source category | Commercial APIs |
| information available | Costs, plans, RFIs, depending on vendor |
| API/access mechanism | OAuth / vendor keys |
| licensing/reuse status | Contract-defined. **RESEARCH REQUIRED** per vendor. |
| geographic coverage | Vendor |
| update frequency/version | Vendor |
| applicable Construction Graph entities | Costs, Documents, Changes |
| provenance requirements | Vendor, object id, retrieved_at |
| priority | P2 |
| validation status | Unverified |
| notes/restrictions | Store as Class B under the tenant that connected the integration |

## Intentionally excluded for now

- Web scraping of drawings, specs, or product catalogs
- Training on other tenants’ projects
- Using SITEPM isolation-test accounts as published sample data

## Next registry checkpoint

Before any ingest implementation: pick one city permit API **or** one manufacturer document path, obtain written license/terms, record `validation status = reviewed`, then design a Class A vs Class B storage split.
