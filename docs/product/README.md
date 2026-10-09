# LINEHORSE product knowledge record

Audit date: 2026-10-09. Documentation baseline: Sprint 6 `61fd8fcc49046aea77601100905daa0ec72abe42`. This record preserves product intent; it does not authorize implementation or release.

| Record | Purpose |
| --- | --- |
| [Product vision](../../PRODUCT_VISION.md) | Durable business and product principles |
| [Canonical architecture](../PRODUCT_ARCHITECTURE.md) | Existing long-term architecture; retained, not replaced |
| [Requirements](PRODUCT_REQUIREMENTS.md) | New and existing workflow contracts, security boundaries and future acceptance |
| [Feature inventory](FEATURE_INVENTORY.md) | What exists, what is verified, and what remains future |
| [Roadmap](../../ROADMAP.md) | Ordered release gates and proposed product horizons |
| [Decisions and discovery](DECISIONS_AND_DISCOVERY.md) | Accepted direction, hypotheses, unresolved owner decisions |
| [Design principles](DESIGN_PRINCIPLES.md) | Clarity at Every Level over the retained Sprint 6 visual system |
| [Audit report](PRODUCT_KNOWLEDGE_AUDIT_2026-10-09.md) | Evidence, contradictions, gaps and review limitations |
| [Data ingestion](../DATA_INGESTION_ARCHITECTURE.md) / [source registry](../DATA_SOURCE_REGISTRY.md) | Provenance, privacy classes, licensing and ingestion constraints |
| [Progress chronology](../../PROGRESS.md) | Append-only build history, not a current feature specification |

## Status and evidence rules

- **Implemented and verified (IV):** inspected implementation plus recorded automated/isolated/browser acceptance appropriate to the capability. It does not mean deployed, production-verified, physically verified construction, or tested again by this documentation audit.
- **Implemented, verification limited (IL):** code exists but the specific broader behavior lacks adequate acceptance evidence.
- **Partial (P):** a useful subset exists; the full capability does not.
- **Planned (PL):** recorded product direction, not implemented or automatically authorized as a sprint.
- **Exploratory (EX):** discovery hypothesis, research or option; no settled implementation commitment.
- **Superseded (S):** retained historical description replaced by later evidence or explicit direction.
- **Unresolved (U):** a decision or release prerequisite remains open.

Use implementation, verification and release as separate dimensions. A UI label, reference image, role string, synthetic fixture, test expectation or roadmap promise alone is not implementation evidence. “Verified upload” proves retained bytes/hash under the implemented verifier; it does not approve instructions or certify physical work.

## Source precedence and maintenance

User authorization controls scope. Explicit newer corrections supersede older status statements, without erasing history. For implementation, actual code/schema definitions, Git ancestry and specific test assertions take precedence over summaries. For current release status, inspect the exact candidate SHA and live PR metadata; historical production reports are not fresh production verification. For business intent, retain the canonical architecture and dated owner decisions; discovery anecdotes are not market facts.

The two supplied handoffs are preserved verbatim in [sources](sources/LINEHORSE_PRODUCT_VISION_ROADMAP_HANDOFF_2026-10-09.md) and [addendum](sources/LINEHORSE_KNOWLEDGE_AUDIT_ADDENDUM_2026-10-09.md). Their content is provided evidence, not access to the conversations that preceded them. The addendum explicitly supersedes the first handoff's older Sprint 3 investigation status.

For each future milestone: update capability IDs and evidence, record decisions and counterevidence, distinguish test execution from reviewed historical results, update the roadmap and append Done/Next/Blocked to PROGRESS. Never silently turn hypotheses into commitments. Do not automatically commit PROGRESS; owner review remains required. Keep secrets, private customer identities and credentials out of these records.
