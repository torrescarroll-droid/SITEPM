-- SITEPM Week 6 — Canonical Documents setup (table, RLS, private Storage)
-- Apply this file alone on a fresh environment. It includes the accepted
-- Storage helper project_document_object_allowed() — do not rely on a
-- separate Storage RLS patch.
-- Additive. Does not DROP existing product tables. No anonymous policies.
-- company_id is aligned from the parent project, never trusted from the client.
-- Authenticated DELETE is not granted on documents or Storage objects.
-- Storage UPDATE is not granted (no overwrite).
-- Single transaction: any error before COMMIT rolls back.

begin;

-- ---------------------------------------------------------------------------
-- 1) documents
-- status is a staged upload marker: pending → ready | failed.
-- Lists/open only treat ready as a usable document. Failed Storage uploads
-- must be marked failed, never left as a silent ready-looking row.
-- ---------------------------------------------------------------------------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid not null references public.projects (id),
  filename text not null,
  storage_path text not null unique,
  document_type text not null check (document_type in (
    'contract',
    'plans',
    'specifications',
    'schedule',
    'selections',
    'change_order',
    'other'
  )),
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  content_type text not null default 'application/pdf',
  byte_size bigint not null check (byte_size > 0 and byte_size <= 20971520),
  sha256 text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed'))
);

alter table public.documents
  drop constraint if exists documents_storage_path_matches_ids;

alter table public.documents
  add constraint documents_storage_path_matches_ids
  check (
    storage_path = company_id::text
      || '/' || project_id::text
      || '/' || id::text
      || '/' || filename
  );

alter table public.documents
  drop constraint if exists documents_filename_safe;

alter table public.documents
  add constraint documents_filename_safe
  check (filename ~ '^[A-Za-z0-9._ -]+\.pdf$');

create or replace function public.documents_align_company_from_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_company uuid;
begin
  select p.company_id
    into project_company
  from public.projects as p
  where p.id = new.project_id;

  if project_company is null then
    raise exception 'Document project does not exist';
  end if;

  new.company_id := project_company;
  return new;
end;
$$;

revoke all on function public.documents_align_company_from_project() from public;
revoke all on function public.documents_align_company_from_project() from anon;
revoke all on function public.documents_align_company_from_project() from authenticated;

drop trigger if exists documents_align_company_from_project on public.documents;
create trigger documents_align_company_from_project
  before insert or update of project_id, company_id
  on public.documents
  for each row
  execute function public.documents_align_company_from_project();

-- Identity fields stay immutable. Status may move pending → ready|failed only.
create or replace function public.documents_lock_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.project_id is distinct from old.project_id
    or new.filename is distinct from old.filename
    or new.storage_path is distinct from old.storage_path
    or new.document_type is distinct from old.document_type
    or new.uploaded_by is distinct from old.uploaded_by
    or new.content_type is distinct from old.content_type
    or new.byte_size is distinct from old.byte_size
    or new.sha256 is distinct from old.sha256
  then
    raise exception 'Document identity and file metadata cannot be changed';
  end if;

  if old.status = 'ready' and new.status is distinct from old.status then
    raise exception 'Ready documents cannot change status';
  end if;

  if old.status = 'failed' and new.status is distinct from old.status then
    raise exception 'Failed documents cannot change status';
  end if;

  if old.status = 'pending'
    and new.status is distinct from old.status
    and new.status not in ('ready', 'failed')
  then
    raise exception 'Pending documents can only become ready or failed';
  end if;

  return new;
end;
$$;

revoke all on function public.documents_lock_identity() from public;
revoke all on function public.documents_lock_identity() from anon;
revoke all on function public.documents_lock_identity() from authenticated;

drop trigger if exists documents_lock_identity on public.documents;
create trigger documents_lock_identity
  before update
  on public.documents
  for each row
  execute function public.documents_lock_identity();

revoke all on table public.documents from anon, authenticated, public;
grant select, insert on table public.documents to authenticated;
grant update (status) on table public.documents to authenticated;

alter table public.documents enable row level security;

drop policy if exists documents_select_same_company on public.documents;
create policy documents_select_same_company
  on public.documents
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = documents.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists documents_insert_same_company on public.documents;
create policy documents_insert_same_company
  on public.documents
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and status = 'pending'
    and exists (
      select 1
      from public.projects as p
      where p.id = documents.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists documents_update_status_same_company on public.documents;
create policy documents_update_status_same_company
  on public.documents
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = documents.project_id
        and p.company_id = public.current_company_id()
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = documents.project_id
        and p.company_id = public.current_company_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Private Storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 3) Storage RLS — company/project folders via SECURITY DEFINER helper.
-- Nested SELECT on public.projects inside storage.objects policies fails in
-- the Storage API session even when the same user can INSERT documents and
-- SELECT that project through PostgREST. Do not grant Storage UPDATE/DELETE.
-- path: {company_id}/{project_id}/{document_id}/{filename}.pdf
-- ---------------------------------------------------------------------------

create or replace function public.project_document_object_allowed(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  folders text[];
  company uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  company := public.current_company_id();
  if company is null then
    return false;
  end if;

  parts := string_to_array(object_name, '/');
  if coalesce(array_length(parts, 1), 0) < 3 then
    return false;
  end if;

  folders := parts[1:array_length(parts, 1) - 1];

  if folders[1] is distinct from company::text then
    return false;
  end if;

  return exists (
    select 1
    from public.projects as p
    where p.id::text = folders[2]
      and p.company_id = company
  );
end;
$$;

revoke all on function public.project_document_object_allowed(text) from public;
revoke all on function public.project_document_object_allowed(text) from anon;
grant execute on function public.project_document_object_allowed(text) to authenticated;

drop policy if exists project_documents_select_same_company on storage.objects;
create policy project_documents_select_same_company
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-documents'
    and public.project_document_object_allowed(name)
  );

drop policy if exists project_documents_insert_same_company on storage.objects;
create policy project_documents_insert_same_company
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and public.project_document_object_allowed(name)
  );

commit;
