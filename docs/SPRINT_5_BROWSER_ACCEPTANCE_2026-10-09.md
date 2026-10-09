# Sprint 5 acceptance completion — 2026-10-09

Baseline: PR #5 `7bfe1efe5f5130e4a094a61c6b6d2d8f87232edd`. Tested the actual webpack production build on loopback port 3108 with the retained `sitepm-documents-verified-replay` Supabase stack. All accounts, projects, documents and fault injection were isolated synthetic fixtures. No production access, migration, merge or deployment occurred.

## Browser recovery

The prior browser session had stalled click/keyboard dispatch after a native confirmation. Its temporary tabs had been cleaned up. A fresh tab in the **same** Codex in-app browser successfully submitted sign-in and all subsequent interactions. Existing inline document confirmations required no native dialog. No alternate automation engine, DOM mutation, authentication bypass, relaxed RLS or application test hook was used. The underlying automation-runner defect is unknown; recovery is verified by successful interactions, not attributed to an unproven root cause.

## Completed browser acceptance

| Workflow | Evidence |
| --- | --- |
| Desktop upload | File chooser selected the repository's real multi-page PDF. Preparing/verifying states disabled duplicate submission. Detail rendered one available verified candidate without automatically selecting it as current. |
| Desktop promotion | Inline confirmation followed by Saving, Change saved, and Current version. |
| Desktop link/archive/restore | Exact version 1 linked to the existing synthetic task. Archive required confirmation, retained history/links and removed file access controls. Restore returned the same version and reference. |
| Desktop metadata search | Searching the saved title returned exactly the matching group. |
| Desktop failure | A narrowly scoped local trigger rejected trusted verification. UI reported verification unconfirmed and offered retry; database showed pending, null verified_at, zero verified receipts and null current pointer. |
| Desktop interrupted confirmation | Retry with a 15-second isolated verification delay was interrupted by reload. Original metadata and request identity recovered. Reload required file reselection. Same-file retry reconciled already committed verification and opened the source: one version, one attempt, one verified receipt. |
| Mobile upload/promotion | At 390×844, uploaded a different PDF as version 2 with an issue label. UI explicitly confirmed stored verification; version 1 remained current until inline version-2 promotion. |
| Mobile version links | The task stayed pinned to version 1 with a newer-current warning. Schedule and daily report were pinned to version 2. All persisted references remained after archive/restore and reload. |
| Mobile archive/restore | Confirmed archive, reloaded to verify archived state without downloads, then restored the same two-version group and its three references. |
| Mobile rejected/interrupted retry | Repeated rejection and delayed-confirmation/reload recovery. Changed-file retry was rejected. Same-file retry recovered exactly one version and receipt, without automatic current selection. |
| Mobile search/keyboard | Enter submitted metadata search and the returned document opened. |
| Source text search | Explicitly indexed original PDF, selected it current, searched hydronic manifold within the project. UI returned exact source page-0001, version ID, hash prefix and source excerpt, labelled as source text rather than AI interpretation. |
| Tenant switch | Logged out A and signed into B normally. A's document URL returned 404 on desktop and mobile; B's directory/search contained only its project and no A document results. Foreign file denial was also verified through authenticated HTTP/Storage acceptance; browser navigation to the attachment endpoint was blocked by the browser client and is not claimed as an observed HTTP status. |
| Layout | Inspected 390×844 and 320×740 emulated viewports. DOM viewport/document widths matched (390/390 and 320/320); no horizontal overflow. Reset viewport after testing. |

Persistence evidence: recovery desktop family `fe36eedb-74ba-47a0-a1a6-32dc2e4e1857`; mobile `0ab52986-2a89-4f97-95b7-3c53cc9e525f`. Both rejected states had zero verified receipts. After recovery each had one version, one attempt, one verified receipt, ready status and no current pointer. Source family `55bd6a6b-3bf4-4062-aa7a-33fc153eb521` retained two immutable versions and three pinned references; promotion never rewrote reference versions.

`scripts/document-browser-fixtures.mjs` provides reproducible delay/reject/off/inspect controls. It invokes the existing loopback environment guard before connecting. Faults apply only to verification of families with the explicit synthetic `Browser acceptance recovery` title prefix, never alter application permissions, and were removed after testing. Run only against a disposable isolated test stack. The test trigger is not a migration or runtime application feature.

## Regression and quality evidence

- `npm run test:documents`: environment guards, format validation, bounded resumable transport and actual server-action harness passed.
- `document-acceptance-local.mjs`: populated legacy adoption, document Auth/RLS/Storage, atomic rollback, duplicate/concurrent retry, stale edits, version allocation, scoped typed links, PDF extraction/provenance/current-only search, real multi-chunk TUS HEAD/resume/hash and limits all passed.
- The same isolated run passed Sprint 3 field persistence and Sprint 4 database acceptance, including all four integrity reproducers and role/function privilege review.
- Field reliability, scheduling, operations, core-job, job-desk, Ask Stage 3 and lexical unit regressions passed.
- TypeScript passed. Lint passed with the existing unused `tokenize` warning in `lib/ask-stage4e-fts-experiment1.ts:197` and no errors.
- Authenticated built-app route/file-denial checks and supported webpack build results are recorded in the implementation acceptance addendum.

Browser screenshots retained locally: `/private/tmp/sitepm-sprint5-mobile-acceptance.jpg` and `/private/tmp/sitepm-sprint5-desktop-acceptance.jpg`. Synthetic local evidence only; screenshots are not required runtime assets.

## Limits and verdict

**READY WITH CONDITIONS for review.** This closes the previously blocking desktop/mobile saved-flow gap. No new product defect was found requiring application or schema changes. This completion adds reproducible isolated browser fault controls and evidence, not reduced coverage.

Reload interruption was exercised during server verification of an uploaded object. Byte-transfer disconnect/resume is covered by the separate real multi-chunk TUS test and mocked transport failure tests, not by browser network emulation. Physical devices, cellular networks, browser Office/image uploads, large-company load and production configuration/backup restoration were not tested. Format security tests cover supported non-PDF formats; no antivirus claim is made.

Release order remains Sprint 3 → Sprint 4 → Sprint 5. Before release: verify database **and Storage blob** backup/restoration, production project/schema/privilege preflight, provision the restricted verifier safely, and pause document writes through migration plus matching application deployment. The old uploader cannot safely run against the new write boundary. Explicit release authorization is still required; no automatic production migration or destructive rollback is permitted.
