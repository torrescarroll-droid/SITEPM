/**
 * Generates table-owner SQL for the RP001 4E-B FTS adapter fixture.
 * DOES NOT execute SQL. DOES NOT connect to hosted Supabase.
 *
 * Requires:
 *   SITEPM_BENCH_FIXTURE=RP001_4EB
 *   SITEPM_BENCH_COMPANY_ID=<uuid>
 *   SITEPM_BENCH_PROJECT_ID=<uuid>
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  SITEPM_MARKDOWN_EXTRACTOR_NAME,
  SITEPM_MARKDOWN_EXTRACTOR_VERSION,
} from "@/lib/document-extract";
import {
  RP001_SOURCE_IDS,
  SITEPM_BENCH_FIXTURE_CONFIRMATION,
  STAGE4E_FTS_PROOF_BOUNDARY,
  buildRp001DocumentIdMap,
  isUuid,
  rp001BenchmarkAdapterFilename,
} from "@/lib/ask-stage4e-fts";
import { extractRp001Corpus, loadRp001Register } from "@/lib/rp001-corpus";

const LIFECYCLE_CAVEAT =
  "RP001 4E-B database fixture bypasses the production PDF upload/Storage preservation path. Its ready document rows exist only to satisfy the existing derived-evidence/FTS schema and must not be interpreted as proof of upload or preservation behavior.";

function env(name: string) {
  return (process.env[name] ?? "").trim();
}

function dollarQuote(tag: string, value: string) {
  const safeTag = tag.replace(/[^a-z0-9_]/gi, "_");
  if (value.includes(`$${safeTag}$`)) {
    throw new Error(`SQL dollar-quote collision for tag ${safeTag}`);
  }
  return `$${safeTag}$${value}$${safeTag}$`;
}

function sqlUuid(value: string) {
  if (!isUuid(value)) {
    throw new Error(`Refusing to emit a non-UUID: ${value}`);
  }
  return `'${value.toLowerCase()}'::uuid`;
}

const fixtureFlag = env("SITEPM_BENCH_FIXTURE");
const companyId = env("SITEPM_BENCH_COMPANY_ID");
const projectId = env("SITEPM_BENCH_PROJECT_ID");

if (fixtureFlag !== SITEPM_BENCH_FIXTURE_CONFIRMATION) {
  console.error(
    `REFUSE generate 4E-B fixture SQL: set SITEPM_BENCH_FIXTURE=${SITEPM_BENCH_FIXTURE_CONFIRMATION} (got empty or mismatch). No SQL written. No hosted mutation.`,
  );
  process.exit(1);
}
if (!isUuid(companyId) || !isUuid(projectId)) {
  console.error(
    "REFUSE generate 4E-B fixture SQL: SITEPM_BENCH_COMPANY_ID and SITEPM_BENCH_PROJECT_ID must be UUIDs. No SQL written. No hosted mutation.",
  );
  process.exit(1);
}

const register = loadRp001Register();
const { bySource } = buildRp001DocumentIdMap();
const uniqueIds = new Set([...bySource.values()]);
if (uniqueIds.size !== RP001_SOURCE_IDS.length) {
  throw new Error("Deterministic 4E-B document UUIDs collided; refusing to generate.");
}
const drafts = extractRp001Corpus({
  documentIdFor: (sourceId) => {
    const id = bySource.get(sourceId);
    if (!id) {
      throw new Error(`No deterministic UUID for ${sourceId}`);
    }
    return id;
  },
  companyId,
  projectId,
});

const header = `-- SITEPM Stage 4E-B RP001 BENCHMARK FTS ADAPTER
-- ${LIFECYCLE_CAVEAT}
--
-- POSTGRESQL FTS fixture ONLY.
-- NOT production upload / Storage / PDF extraction / Ask cookie validation / 4F.
-- The .pdf filename suffix satisfies documents_filename_safe ONLY.
-- Source bytes are Markdown. content_type is text/markdown. sha256 is Markdown.
-- Do NOT create Storage objects. Do NOT wrap these sources as PDFs.
--
-- TABLE OWNER / SQL EDITOR ONLY. Do not run as authenticated JWT.
-- This file was GENERATED and is not executed by npm scripts.
-- No GRANT, DROP, TRUNCATE, ALTER, or policy changes.
--
-- ONE RP001 4E-B FIXTURE PER DATABASE:
-- Deterministic document UUIDs are global documents.id primary keys.
-- A second isolated benchmark company cannot host another copy at the same time
-- with this ID scheme. Collision guards refuse insert if those UUIDs already
-- exist (no accidental takeover). This is an operational constraint, not a
-- security weakness.

begin;

do $guard$
begin
  if not exists (
    select 1 from public.companies where id = ${sqlUuid(companyId)}
  ) then
    raise exception '4E-B fixture: benchmark company % does not exist', ${sqlUuid(companyId)};
  end if;
  if not exists (
    select 1
    from public.projects
    where id = ${sqlUuid(projectId)}
      and company_id = ${sqlUuid(companyId)}
  ) then
    raise exception '4E-B fixture: benchmark project missing or company mismatch';
  end if;
  if exists (
    select 1
    from public.documents
    where id in (
      ${[...bySource.values()].map((id) => sqlUuid(id)).join(",\n      ")}
    )
  ) then
    raise exception '4E-B fixture: one or more deterministic benchmark document UUIDs already exist';
  end if;
end;
$guard$;
`;

const documentInserts: string[] = [];
const writerCalls: string[] = [];
const documentIds: string[] = [];

for (const sourceId of RP001_SOURCE_IDS) {
  const docMeta = register.documents.find((item) => item.id === sourceId);
  const draft = drafts.find(
    (item) => item.document_id === bySource.get(sourceId),
  );
  if (!docMeta || !draft) {
    throw new Error(`Missing register/draft for ${sourceId}`);
  }
  const documentId = bySource.get(sourceId)!;
  documentIds.push(documentId);
  const filename = rp001BenchmarkAdapterFilename(sourceId);
  const storagePath = `${companyId.toLowerCase()}/${projectId.toLowerCase()}/${documentId}/${filename}`;
  const byteSize = Buffer.from(draft.extracted_text, "utf8").length;
  if (byteSize <= 0 || byteSize > 20971520) {
    throw new Error(`Invalid byte_size for ${sourceId}`);
  }
  if (draft.source_sha256 !== docMeta.sha256) {
    throw new Error(`SHA-256 mismatch for ${sourceId}`);
  }

  documentInserts.push(`
-- ${sourceId} adapter filename is NOT evidence of PDF bytes.
insert into public.documents (
  id, company_id, project_id, filename, storage_path, document_type,
  uploaded_by, content_type, byte_size, sha256, status
) values (
  ${sqlUuid(documentId)},
  ${sqlUuid(companyId)},
  ${sqlUuid(projectId)},
  ${dollarQuote("fn", filename)},
  ${dollarQuote("sp", storagePath)},
  'other',
  null,
  'text/markdown',
  ${byteSize},
  ${dollarQuote("sha", docMeta.sha256)},
  'ready'
);`);

  const chunks = draft.chunks.map((chunk) => ({
    locator: chunk.locator,
    locator_type: chunk.locator_type,
    part_index: chunk.part_index,
    body: chunk.body,
    source_issued_on: chunk.source_issued_on,
    source_effective_on: chunk.source_effective_on,
  }));

  writerCalls.push(`
select public.replace_ready_document_extraction(
  ${sqlUuid(documentId)},
  ${dollarQuote("wsha", docMeta.sha256)},
  ${dollarQuote("en", SITEPM_MARKDOWN_EXTRACTOR_NAME)},
  ${dollarQuote("ev", SITEPM_MARKDOWN_EXTRACTOR_VERSION)},
  'markdown',
  ${dollarQuote("xt", draft.extracted_text)},
  ${dollarQuote("io", docMeta.issued_on)}::date,
  null,
  ${dollarQuote("ch", JSON.stringify(chunks))}::jsonb
);`);
}

const expectedParentValues = RP001_SOURCE_IDS.map((sourceId) => {
  const docMeta = register.documents.find((item) => item.id === sourceId);
  const documentId = bySource.get(sourceId);
  if (!docMeta || !documentId) {
    throw new Error(`Missing parent identity for ${sourceId}`);
  }
  return `(${sqlUuid(documentId)}, ${dollarQuote(`psha_${sourceId.replace(/-/g, "_")}`, docMeta.sha256)})`;
}).join(",\n    ");

const expectedLocatorValues = RP001_SOURCE_IDS.flatMap((sourceId) => {
  const docMeta = register.documents.find((item) => item.id === sourceId);
  const documentId = bySource.get(sourceId);
  if (!docMeta || !documentId) {
    throw new Error(`Missing locator identity for ${sourceId}`);
  }
  return docMeta.locators.map(
    (locator) =>
      `(${sqlUuid(documentId)}, ${dollarQuote(`loc_${sourceId.replace(/-/g, "_")}_${locator}`, locator)}, ${dollarQuote(`lsha_${sourceId.replace(/-/g, "_")}_${locator}`, docMeta.sha256)})`,
  );
}).join(",\n    ");

const fixtureDocumentIdList = documentIds
  .map((id) => sqlUuid(id))
  .join(",\n      ");

const fixtureSql = [
  header,
  ...documentInserts,
  ...writerCalls,
  `
-- Fail-closed fixture verification. Runs before COMMIT.
do $verify$
declare
  parent_ok integer;
  extraction_ok integer;
  unexpected_extractions integer;
  missing_locators integer;
  unbound_chunks integer;
begin
  select count(*)
    into parent_ok
  from (
    values
    ${expectedParentValues}
  ) as expected(id, source_sha256)
  join public.documents as d
    on d.id = expected.id
  where d.company_id = ${sqlUuid(companyId)}
    and d.project_id = ${sqlUuid(projectId)}
    and d.status = 'ready'
    and d.content_type = 'text/markdown'
    and d.document_type = 'other'
    and d.sha256 is not distinct from expected.source_sha256;

  if parent_ok is distinct from 15 then
    raise exception '4E-B verify: expected 15 bound ready adapter documents, found %', parent_ok;
  end if;

  select count(*)
    into extraction_ok
  from (
    values
    ${expectedParentValues}
  ) as expected(id, source_sha256)
  join public.document_extractions as x
    on x.document_id = expected.id
  where x.company_id = ${sqlUuid(companyId)}
    and x.project_id = ${sqlUuid(projectId)}
    and x.source_sha256 is not distinct from expected.source_sha256
    and x.extractor_name = ${dollarQuote("ven", SITEPM_MARKDOWN_EXTRACTOR_NAME)}
    and x.extractor_version = ${dollarQuote("vev", SITEPM_MARKDOWN_EXTRACTOR_VERSION)}
    and x.content_kind = 'markdown';

  if extraction_ok is distinct from 15 then
    raise exception '4E-B verify: expected 15 bound extractions, found %', extraction_ok;
  end if;

  select count(*)
    into unexpected_extractions
  from public.document_extractions as x
  where x.document_id in (
      ${fixtureDocumentIdList}
    )
    and not exists (
      select 1
      from (
        values
        ${expectedParentValues}
      ) as expected(id, source_sha256)
      where expected.id = x.document_id
        and x.company_id = ${sqlUuid(companyId)}
        and x.project_id = ${sqlUuid(projectId)}
        and x.source_sha256 is not distinct from expected.source_sha256
        and x.extractor_name = ${dollarQuote("uen", SITEPM_MARKDOWN_EXTRACTOR_NAME)}
        and x.extractor_version = ${dollarQuote("uev", SITEPM_MARKDOWN_EXTRACTOR_VERSION)}
        and x.content_kind = 'markdown'
    );

  if unexpected_extractions is distinct from 0 then
    raise exception '4E-B verify: unexpected extraction mapping count %', unexpected_extractions;
  end if;

  select count(*)
    into missing_locators
  from (
    values
    ${expectedLocatorValues}
  ) as expected(document_id, locator, source_sha256)
  where not exists (
    select 1
    from public.document_chunks as c
    join public.document_extractions as x
      on x.id = c.extraction_id
     and x.document_id = c.document_id
    where c.document_id = expected.document_id
      and c.locator = expected.locator
      and c.company_id = ${sqlUuid(companyId)}
      and c.project_id = ${sqlUuid(projectId)}
      and c.source_sha256 is not distinct from expected.source_sha256
      and x.company_id = ${sqlUuid(companyId)}
      and x.project_id = ${sqlUuid(projectId)}
  );

  if missing_locators is distinct from 0 then
    raise exception '4E-B verify: missing % expected document+locator chunks', missing_locators;
  end if;

  select count(*)
    into unbound_chunks
  from public.document_chunks as c
  where c.document_id in (
      ${fixtureDocumentIdList}
    )
    and (
      c.company_id is distinct from ${sqlUuid(companyId)}
      or c.project_id is distinct from ${sqlUuid(projectId)}
      or not exists (
        select 1
        from public.document_extractions as x
        where x.id = c.extraction_id
          and x.document_id = c.document_id
          and x.company_id = ${sqlUuid(companyId)}
          and x.project_id = ${sqlUuid(projectId)}
      )
      or not exists (
        select 1
        from (
          values
          ${expectedParentValues}
        ) as expected(id, source_sha256)
        where expected.id = c.document_id
          and c.source_sha256 is not distinct from expected.source_sha256
      )
    );

  if unbound_chunks is distinct from 0 then
    raise exception '4E-B verify: % fixture chunks are unbound or identity-mismatched', unbound_chunks;
  end if;
end;
$verify$;

-- Informational listing after fail-closed checks.
select id, filename, content_type, status, sha256
from public.documents
where id in (
    ${fixtureDocumentIdList}
  )
  and company_id = ${sqlUuid(companyId)}
  and project_id = ${sqlUuid(projectId)}
order by filename;

commit;
`,
].join("\n");

const cleanupSql = `-- SITEPM Stage 4E-B RP001 BENCHMARK FTS ADAPTER — CLEANUP
-- ${LIFECYCLE_CAVEAT}
-- Deletes ONLY the 15 recorded benchmark document UUIDs (extractions/chunks cascade).
-- Does NOT delete auth users or companies.
-- Optional project delete is commented out.

begin;

delete from public.documents
where id in (
  ${documentIds.map((id) => sqlUuid(id)).join(",\n  ")}
)
and project_id = ${sqlUuid(projectId)}
and company_id = ${sqlUuid(companyId)};

-- Uncomment only when operator explicitly wants the bench project removed:
-- delete from public.projects
-- where id = ${sqlUuid(projectId)}
--   and company_id = ${sqlUuid(companyId)};

commit;
`;

const outDir = join("artifacts", "ask-stage4e-fts");
mkdirSync(outDir, { recursive: true });
const fixturePath = join(outDir, "fixture.sql");
const cleanupPath = join(outDir, "cleanup.sql");
writeFileSync(fixturePath, fixtureSql);
writeFileSync(cleanupPath, cleanupSql);
writeFileSync(
  join(outDir, "mapping.json"),
  `${JSON.stringify(
    {
      proof_boundary: STAGE4E_FTS_PROOF_BOUNDARY,
      company_id: companyId.toLowerCase(),
      project_id: projectId.toLowerCase(),
      documents: Object.fromEntries(
        RP001_SOURCE_IDS.map((sourceId) => [
          sourceId,
          {
            document_id: bySource.get(sourceId),
            filename: rp001BenchmarkAdapterFilename(sourceId),
          },
        ]),
      ),
    },
    null,
    2,
  )}\n`,
);

console.log("Generated 4E-B fixture SQL (NOT executed):", fixturePath);
console.log("Generated 4E-B cleanup SQL (NOT executed):", cleanupPath);
console.log(STAGE4E_FTS_PROOF_BOUNDARY);
