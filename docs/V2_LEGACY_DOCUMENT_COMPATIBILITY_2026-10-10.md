# V2 legacy document compatibility — 2026-10-10

Development-only correction; no production/recovery connections or migrations executed.

## Cause and provenance

The recovered-baseline preflight previously found 15 ready text/markdown documents among 23 records. Sprint 5 previously required MIME/extension agreement for every existing row. The historical generator scripts/generate-ask-stage4e-fts-sql.ts explicitly creates ready Markdown benchmark records with PDF adapter filenames, original Markdown hashes, and no Storage objects. This explains a supported historical creation path; it does not independently prove the provenance of each recovered row. These are existing reference/benchmark records, not evidence of uploaded PDF bytes. Preserve them without relabeling, inventing Storage objects, or asserting fresh verification.

## Narrow correction

The table CHECK admits legacy text/markdown only with the historical safe .pdf filename form. A SECURITY INVOKER BEFORE INSERT OR UPDATE trigger rejects every new Markdown insert and every transition into Markdown or change of its filename. Existing documents_lock_identity continues to reject changes to canonical identity, tenant, ownership, path, MIME, hash and size. Status-only writes remain subject to the original state rules. No client exception flag, allowlist privilege, new role, SECURITY DEFINER or RLS change is introduced.

The existing exclusive documents adoption lock ensures no concurrent uploader can slip a Markdown insert between adoption and guard installation. New Markdown inserts are rejected even through the bounded writer RPC. Other unsupported MIME/extension pairs still fail the existing CHECK. New uploads retain file envelope/size validation and trusted verification. All canonical rows remain untouched; existing family/version backfills preserve original IDs and paths, one initial version per source, and ready current-version pointers. Legacy versions do not receive invented verified_at timestamps. Benchmark records with no blobs still cannot be downloaded; this fix does not manufacture bytes.

## Verification and limits

Document validation/action/transport/environment, field-report reliability, scheduling and lexical retrieval unit regressions passed. Focused tests reject .md uploads and Markdown disguised as PDF bytes, assert SQL guard installation/revocation and unchanged adoption mappings. Database acceptance now includes forged Markdown registration rejection; the guarded legacy fixture includes a ready Markdown record with complete metadata preservation assertions. These database tests are prepared, NOT executed: migrations are prohibited for this task. Real SQL behavior and all 23 recovered rows must be verified during authorized V2 rehearsal.

Lint: zero errors, one pre-existing unused tokenize warning. Supported production build and final TypeScript results are reported with the task output. No commit/push or application behavior change. The fifth migration checksum is updated in supabase/release-sprints-3-6.json; the first four and explicit order are unchanged.

Next: review this diff and authorize publication of the revised candidate/manifest, followed by recovery-only V2 rehearsal. Require unchanged original document metadata/relationships, complete family/version adoption, rejection of new Markdown and forged MIME, and unchanged RLS/role boundaries.
