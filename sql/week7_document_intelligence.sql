-- SITEPM Week 7 / Ask Stage 4A — derived document evidence foundations
-- Additive. Does not DROP product tables, Storage, or document identity.
-- Does not extract text, change Ask, or seed Reference Project 001.
-- Original `documents` rows remain the source of authority.
-- Single transaction: any error before COMMIT rolls back.

begin;

-- ---------------------------------------------------------------------------
-- Write authority (Stage 4A)
-- Authenticated users may SELECT derived rows for their company (RLS).
-- They must NOT INSERT/UPDATE/DELETE canonical extraction or chunk text.
-- Fabricating chunks that later Ask could treat as extracted source is denied.
-- Future 4B extraction must write through a table-owner / SECURITY DEFINER
-- path whose EXECUTE remains revoked from anon and authenticated (not a
-- user JWT PostgREST insert, not a broad service-role Ask shortcut).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1) document_extractions — one derived representation per source document
-- ---------------------------------------------------------------------------

create table if not exists public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid not null references public.projects (id),
  document_id uuid not null unique references public.documents (id) on delete cascade,
  source_sha256 text not null,
  extractor_name text not null,
  extractor_version text not null,
  content_kind text not null check (content_kind in (
    'markdown',
    'plain_text',
    'pdf_text'
  )),
  extracted_text text not null default '',
  source_issued_on date,
  source_effective_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_extractions_sha256_format
    check (source_sha256 ~ '^[a-f0-9]{64}$'),
  constraint document_extractions_extractor_name_present
    check (char_length(trim(extractor_name)) > 0),
  constraint document_extractions_extractor_version_present
    check (char_length(trim(extractor_version)) > 0)
);

comment on table public.document_extractions is
  'Derived extraction of a ready documents row. Not an independent source of authority.';

-- Bind company/project/sha256 from the parent document. Require ready + hash.
create or replace function public.document_extractions_bind_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_company uuid;
  parent_project uuid;
  parent_sha text;
  parent_status text;
begin
  select d.company_id, d.project_id, d.sha256, d.status
    into parent_company, parent_project, parent_sha, parent_status
  from public.documents as d
  where d.id = new.document_id;

  if parent_company is null then
    raise exception 'Extraction parent document does not exist';
  end if;

  if parent_status is distinct from 'ready' then
    raise exception 'Extraction parent document must be ready';
  end if;

  if parent_sha is null or parent_sha is distinct from new.source_sha256 then
    raise exception 'Extraction source_sha256 must match the parent document hash';
  end if;

  new.company_id := parent_company;
  new.project_id := parent_project;
  return new;
end;
$$;

revoke all on function public.document_extractions_bind_parent() from public;
revoke all on function public.document_extractions_bind_parent() from anon;
revoke all on function public.document_extractions_bind_parent() from authenticated;

drop trigger if exists document_extractions_bind_parent on public.document_extractions;
create trigger document_extractions_bind_parent
  before insert or update of document_id, company_id, project_id, source_sha256
  on public.document_extractions
  for each row
  execute function public.document_extractions_bind_parent();

create or replace function public.document_extractions_lock_provenance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.project_id is distinct from old.project_id
    or new.document_id is distinct from old.document_id
    or new.source_sha256 is distinct from old.source_sha256
  then
    raise exception 'Extraction provenance cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.document_extractions_lock_provenance() from public;
revoke all on function public.document_extractions_lock_provenance() from anon;
revoke all on function public.document_extractions_lock_provenance() from authenticated;

drop trigger if exists document_extractions_lock_provenance on public.document_extractions;
create trigger document_extractions_lock_provenance
  before update
  on public.document_extractions
  for each row
  execute function public.document_extractions_lock_provenance();

revoke all on table public.document_extractions from anon, authenticated, public;
grant select on table public.document_extractions to authenticated;

alter table public.document_extractions enable row level security;

drop policy if exists document_extractions_select_same_company
  on public.document_extractions;
create policy document_extractions_select_same_company
  on public.document_extractions
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = document_extractions.project_id
        and p.company_id = public.current_company_id()
    )
    and exists (
      select 1
      from public.documents as d
      where d.id = document_extractions.document_id
        and d.company_id = public.current_company_id()
        and d.project_id = document_extractions.project_id
        and d.status = 'ready'
        and d.sha256 is not distinct from document_extractions.source_sha256
    )
  );

-- ---------------------------------------------------------------------------
-- 2) document_chunks — locator-scoped derived excerpts for future retrieval
-- ---------------------------------------------------------------------------

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid not null references public.projects (id),
  document_id uuid not null references public.documents (id) on delete cascade,
  extraction_id uuid not null references public.document_extractions (id) on delete cascade,
  source_sha256 text not null,
  locator text not null,
  locator_type text not null check (locator_type in (
    'section',
    'caption',
    'page',
    'part'
  )),
  part_index integer not null default 0 check (part_index >= 0),
  body text not null,
  source_issued_on date,
  source_effective_on date,
  created_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(locator, '') || ' ' || coalesce(body, ''))
  ) stored,
  constraint document_chunks_sha256_format
    check (source_sha256 ~ '^[a-f0-9]{64}$'),
  constraint document_chunks_locator_present
    check (char_length(trim(locator)) > 0),
  constraint document_chunks_extraction_locator_unique
    unique (extraction_id, locator, part_index)
);

comment on table public.document_chunks is
  'Derived locator-scoped excerpts. Traceable to a document_extractions row and ready documents parent. FTS search_vector is a foundation only; Stage 4C will add retrieval.';

create index if not exists document_chunks_project_idx
  on public.document_chunks (company_id, project_id);

create index if not exists document_chunks_document_idx
  on public.document_chunks (document_id);

create index if not exists document_chunks_search_idx
  on public.document_chunks using gin (search_vector);

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
  parent_status text;
begin
  select e.company_id, e.project_id, e.document_id, e.source_sha256,
         e.source_issued_on, e.source_effective_on
    into extraction_company, extraction_project, extraction_document, extraction_sha,
         extraction_issued, extraction_effective
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

drop trigger if exists document_chunks_bind_parent on public.document_chunks;
create trigger document_chunks_bind_parent
  before insert or update of extraction_id, document_id, company_id, project_id, source_sha256
  on public.document_chunks
  for each row
  execute function public.document_chunks_bind_parent();

create or replace function public.document_chunks_lock_provenance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.project_id is distinct from old.project_id
    or new.document_id is distinct from old.document_id
    or new.extraction_id is distinct from old.extraction_id
    or new.source_sha256 is distinct from old.source_sha256
    or new.locator is distinct from old.locator
    or new.locator_type is distinct from old.locator_type
    or new.part_index is distinct from old.part_index
  then
    raise exception 'Chunk provenance cannot be changed';
  end if;
  return new;
end;
$$;

revoke all on function public.document_chunks_lock_provenance() from public;
revoke all on function public.document_chunks_lock_provenance() from anon;
revoke all on function public.document_chunks_lock_provenance() from authenticated;

drop trigger if exists document_chunks_lock_provenance on public.document_chunks;
create trigger document_chunks_lock_provenance
  before update
  on public.document_chunks
  for each row
  execute function public.document_chunks_lock_provenance();

revoke all on table public.document_chunks from anon, authenticated, public;
grant select on table public.document_chunks to authenticated;

alter table public.document_chunks enable row level security;

drop policy if exists document_chunks_select_same_company on public.document_chunks;
create policy document_chunks_select_same_company
  on public.document_chunks
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = document_chunks.project_id
        and p.company_id = public.current_company_id()
    )
    and exists (
      select 1
      from public.document_extractions as e
      where e.id = document_chunks.extraction_id
        and e.company_id = public.current_company_id()
        and e.document_id = document_chunks.document_id
        and e.source_sha256 is not distinct from document_chunks.source_sha256
    )
    and exists (
      select 1
      from public.documents as d
      where d.id = document_chunks.document_id
        and d.company_id = public.current_company_id()
        and d.project_id = document_chunks.project_id
        and d.status = 'ready'
        and d.sha256 is not distinct from document_chunks.source_sha256
    )
  );

-- Stage 4B write hook: present so PostgREST cannot treat user INSERTs as the
-- extraction path. Body refuses all callers. EXECUTE is not granted to API roles.
create or replace function public.replace_document_extraction()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Document extraction writes are not enabled (Stage 4A)';
end;
$$;

revoke all on function public.replace_document_extraction() from public;
revoke all on function public.replace_document_extraction() from anon;
revoke all on function public.replace_document_extraction() from authenticated;

commit;
