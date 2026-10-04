-- SITEPM Week 10 / Ask Stage 4F-C — restricted PDF derived-evidence persist
-- Additive. Does not change documents identity, Storage, Ask, or 4C ranking.
-- Does not GRANT EXECUTE to anon/authenticated/service_role.
-- Does not contain a password.
--
-- APPLY ORDER
-- 1. ENVIRONMENT-SPECIFIC OPS (SQL Editor; do not commit the password):
--      CREATE ROLE sitepm_extractor
--        LOGIN
--        NOSUPERUSER
--        NOCREATEDB
--        NOCREATEROLE
--        NOREPLICATION
--        NOBYPASSRLS
--        NOINHERIT;
--    Then set the LOGIN password in SQL Editor. Never commit it.
-- 2. Apply THIS file in the hosted SITEPM SQL Editor.
-- If sitepm_extractor does not exist, this file raises and rolls back.
--
-- Single transaction: any error before COMMIT rolls back.

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sitepm_extractor') then
    raise exception
      'Create LOGIN role sitepm_extractor in SQL Editor before applying Week 10 grants (password is ops-only, not in this file)';
  end if;
end
$$;

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
set search_path = pg_catalog, public
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
  if jsonb_array_length(p_chunks) = 0 then
    raise exception 'Extraction chunks must not be empty';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_document_id::text), 0);

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
revoke all on function public.replace_ready_document_extraction(
  uuid, text, text, text, text, text, date, date, jsonb
) from service_role;

grant usage on schema public to sitepm_extractor;
grant execute on function public.replace_ready_document_extraction(
  uuid, text, text, text, text, text, date, date, jsonb
) to sitepm_extractor;

revoke all on table public.documents from sitepm_extractor;
revoke all on table public.document_extractions from sitepm_extractor;
revoke all on table public.document_chunks from sitepm_extractor;
revoke all on table public.projects from sitepm_extractor;
revoke all on table public.companies from sitepm_extractor;
revoke all on table public.profiles from sitepm_extractor;
revoke all on table public.tasks from sitepm_extractor;
revoke all on table public.field_logs from sitepm_extractor;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'revoke usage on schema storage from sitepm_extractor';
  end if;
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    execute 'revoke usage on schema auth from sitepm_extractor';
  end if;
end
$$;

revoke all on function public.search_project_document_chunks(
  uuid, text, date, integer
) from sitepm_extractor;
revoke all on function public.replace_document_extraction() from sitepm_extractor;

commit;
