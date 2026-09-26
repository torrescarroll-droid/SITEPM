-- SITEPM Week 8 / Ask Stage 4B — bounded derived-evidence writer
-- Additive. Does not change documents identity, Storage MIME, or Ask.
-- Does not GRANT EXECUTE to anon/authenticated.
-- Apply in the hosted SITEPM Supabase SQL Editor when authorized.
-- Single transaction: any error before COMMIT rolls back.

begin;

-- Chunks inherit content_kind from the extraction parent (Stage 4A table had
-- content_kind only on document_extractions).
alter table public.document_chunks
  add column if not exists content_kind text;

update public.document_chunks as c
set content_kind = e.content_kind
from public.document_extractions as e
where c.extraction_id = e.id
  and c.content_kind is null;

alter table public.document_chunks
  drop constraint if exists document_chunks_content_kind_check;
alter table public.document_chunks
  add constraint document_chunks_content_kind_check
  check (content_kind in ('markdown', 'plain_text', 'pdf_text'));

alter table public.document_chunks
  alter column content_kind set not null;

-- Authenticated clients still cannot INSERT into derived tables (Stage 4A grants).
-- This function is the only intended 4B write path. It never takes company_id
-- or project_id from the caller. Parent documents row supplies those values.
-- EXECUTE remains revoked from API roles so PostgREST users cannot mint chunks.
-- Table-owner / future server worker may execute it; Ask must not use service role.

create or replace function public.replace_ready_document_extraction(
  p_document_id uuid,
  p_source_sha256 text,
  p_extractor_name text,
  p_extractor_version text,
  p_content_kind text,
  p_extracted_text text,
  p_source_issued_on date,
  p_source_effective_on date,
  p_chunks jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_company uuid;
  parent_project uuid;
  parent_sha text;
  parent_status text;
  extraction_uuid uuid;
  chunk jsonb;
begin
  if p_chunks is null or jsonb_typeof(p_chunks) is distinct from 'array' then
    raise exception 'Extraction chunks must be a JSON array';
  end if;

  select d.company_id, d.project_id, d.sha256, d.status
    into parent_company, parent_project, parent_sha, parent_status
  from public.documents as d
  where d.id = p_document_id;

  if parent_company is null then
    raise exception 'Extraction parent document does not exist';
  end if;
  if parent_status is distinct from 'ready' then
    raise exception 'Extraction parent document must be ready';
  end if;
  if parent_sha is null or parent_sha is distinct from p_source_sha256 then
    raise exception 'Extraction source_sha256 must match the parent document hash';
  end if;

  delete from public.document_extractions
  where document_id = p_document_id;

  insert into public.document_extractions (
    company_id,
    project_id,
    document_id,
    source_sha256,
    extractor_name,
    extractor_version,
    content_kind,
    extracted_text,
    source_issued_on,
    source_effective_on
  )
  values (
    parent_company,
    parent_project,
    p_document_id,
    p_source_sha256,
    p_extractor_name,
    p_extractor_version,
    p_content_kind,
    p_extracted_text,
    p_source_issued_on,
    p_source_effective_on
  )
  returning id into extraction_uuid;

  for chunk in
    select value from jsonb_array_elements(p_chunks)
  loop
    insert into public.document_chunks (
      company_id,
      project_id,
      document_id,
      extraction_id,
      source_sha256,
      locator,
      locator_type,
      part_index,
      body,
      source_issued_on,
      source_effective_on,
      content_kind
    )
    values (
      parent_company,
      parent_project,
      p_document_id,
      extraction_uuid,
      p_source_sha256,
      chunk->>'locator',
      chunk->>'locator_type',
      coalesce((chunk->>'part_index')::integer, 0),
      coalesce(chunk->>'body', ''),
      coalesce((chunk->>'source_issued_on')::date, p_source_issued_on),
      coalesce((chunk->>'source_effective_on')::date, p_source_effective_on),
      p_content_kind
    );
  end loop;

  return extraction_uuid;
end;
$$;

revoke all on function public.replace_ready_document_extraction(
  uuid, text, text, text, text, text, date, date, jsonb
) from public;
revoke all on function public.replace_ready_document_extraction(
  uuid, text, text, text, text, text, date, date, jsonb
) from anon;
revoke all on function public.replace_ready_document_extraction(
  uuid, text, text, text, text, text, date, date, jsonb
) from authenticated;

-- Keep the Stage 4A no-arg hook refused and uncallable via API roles.
revoke all on function public.replace_document_extraction() from public;
revoke all on function public.replace_document_extraction() from anon;
revoke all on function public.replace_document_extraction() from authenticated;

-- Reaffirm bind-parent overwrites tenant/hash from the extraction parent so a
-- privileged writer cannot retarget chunks via supplied company/project ids.
create or replace function public.document_chunks_bind_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  extraction_company uuid;
  extraction_project uuid;
  extraction_document uuid;
  extraction_sha text;
  extraction_issued date;
  extraction_effective date;
  extraction_kind text;
  parent_status text;
begin
  select e.company_id, e.project_id, e.document_id, e.source_sha256,
         e.source_issued_on, e.source_effective_on, e.content_kind
    into extraction_company, extraction_project, extraction_document, extraction_sha,
         extraction_issued, extraction_effective, extraction_kind
  from public.document_extractions as e
  where e.id = new.extraction_id;

  if extraction_company is null then
    raise exception 'Chunk extraction parent does not exist';
  end if;

  select d.status
    into parent_status
  from public.documents as d
  where d.id = extraction_document;

  if parent_status is distinct from 'ready' then
    raise exception 'Chunk parent document must be ready';
  end if;

  if new.source_sha256 is distinct from extraction_sha then
    raise exception 'Chunk source_sha256 must match the extraction hash';
  end if;

  if new.document_id is distinct from extraction_document then
    raise exception 'Chunk document_id must match the extraction parent';
  end if;

  new.company_id := extraction_company;
  new.project_id := extraction_project;
  new.document_id := extraction_document;
  new.source_sha256 := extraction_sha;
  new.content_kind := extraction_kind;
  if new.source_issued_on is null then
    new.source_issued_on := extraction_issued;
  end if;
  if new.source_effective_on is null then
    new.source_effective_on := extraction_effective;
  end if;
  return new;
end;
$$;

revoke all on function public.document_chunks_bind_parent() from public;
revoke all on function public.document_chunks_bind_parent() from anon;
revoke all on function public.document_chunks_bind_parent() from authenticated;

commit;
