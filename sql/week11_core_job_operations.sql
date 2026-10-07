-- SITEPM / LINEHORSE Core Job Operations v0.1
-- Additive. Does not DROP product tables, rewrite history, or grant service_role.
-- company_id is aligned from the parent job, never trusted from the client.
-- Authenticated users do not receive document-chunk or extraction writes.
-- Photos follow the private document pattern: pending → ready | failed, no public bucket.

begin;

-- ---------------------------------------------------------------------------
-- 1) Daily report fields on existing field_logs. Existing notes stay valid.
-- ---------------------------------------------------------------------------

alter table public.field_logs
  add column if not exists work_performed text,
  add column if not exists deliveries text,
  add column if not exists equipment text,
  add column if not exists delays text,
  add column if not exists site_events text,
  add column if not exists safety_notes text,
  add column if not exists tomorrow text,
  add column if not exists location_text text;

-- ---------------------------------------------------------------------------
-- 2) Who was on site. Trade can be known without a subcontractor name.
-- ---------------------------------------------------------------------------

create table if not exists public.field_log_crews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid not null references public.projects (id),
  field_log_id uuid not null references public.field_logs (id) on delete cascade,
  company_name text,
  trade_name text not null,
  worker_count integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint field_log_crews_trade_present check (char_length(trim(trade_name)) > 0),
  constraint field_log_crews_worker_count_nonnegative check (
    worker_count is null or worker_count >= 0
  )
);

create index if not exists field_log_crews_field_log_id_idx
  on public.field_log_crews (field_log_id);

create or replace function public.field_log_crews_align_from_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_company uuid;
  parent_project uuid;
begin
  select f.company_id, f.project_id
    into parent_company, parent_project
  from public.field_logs as f
  where f.id = new.field_log_id;

  if parent_company is null then
    raise exception 'Daily report does not exist';
  end if;

  new.company_id := parent_company;
  new.project_id := parent_project;
  return new;
end;
$$;

revoke all on function public.field_log_crews_align_from_report() from public;
revoke all on function public.field_log_crews_align_from_report() from anon;
revoke all on function public.field_log_crews_align_from_report() from authenticated;

drop trigger if exists field_log_crews_align_from_report on public.field_log_crews;
create trigger field_log_crews_align_from_report
  before insert or update of field_log_id, company_id, project_id
  on public.field_log_crews
  for each row
  execute function public.field_log_crews_align_from_report();

revoke all on table public.field_log_crews from anon, authenticated, public;
grant select, insert, update, delete on table public.field_log_crews to authenticated;

alter table public.field_log_crews enable row level security;

drop policy if exists field_log_crews_select_same_company on public.field_log_crews;
create policy field_log_crews_select_same_company
  on public.field_log_crews
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = field_log_crews.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists field_log_crews_insert_same_company on public.field_log_crews;
create policy field_log_crews_insert_same_company
  on public.field_log_crews
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = field_log_crews.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists field_log_crews_update_same_company on public.field_log_crews;
create policy field_log_crews_update_same_company
  on public.field_log_crews
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = field_log_crews.project_id
        and p.company_id = public.current_company_id()
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = field_log_crews.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists field_log_crews_delete_same_company on public.field_log_crews;
create policy field_log_crews_delete_same_company
  on public.field_log_crews
  for delete
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = field_log_crews.project_id
        and p.company_id = public.current_company_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Private jobsite photos. Evidence capture only. No image understanding.
-- ---------------------------------------------------------------------------

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid not null references public.projects (id),
  field_log_id uuid not null references public.field_logs (id) on delete cascade,
  storage_path text not null unique,
  caption text,
  content_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 8388608),
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  constraint photos_content_type_allowed check (
    content_type in ('image/jpeg', 'image/png', 'image/webp')
  )
);

create index if not exists photos_field_log_id_idx on public.photos (field_log_id);

alter table public.photos
  drop constraint if exists photos_storage_path_matches_ids;

alter table public.photos
  add constraint photos_storage_path_matches_ids
  check (
    storage_path = company_id::text
      || '/' || project_id::text
      || '/' || id::text
      || '/' || split_part(storage_path, '/', 4)
  );

create or replace function public.photos_align_from_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_company uuid;
  parent_project uuid;
begin
  select f.company_id, f.project_id
    into parent_company, parent_project
  from public.field_logs as f
  where f.id = new.field_log_id;

  if parent_company is null then
    raise exception 'Daily report does not exist';
  end if;

  new.company_id := parent_company;
  new.project_id := parent_project;
  return new;
end;
$$;

revoke all on function public.photos_align_from_report() from public;
revoke all on function public.photos_align_from_report() from anon;
revoke all on function public.photos_align_from_report() from authenticated;

drop trigger if exists photos_align_from_report on public.photos;
create trigger photos_align_from_report
  before insert or update of field_log_id, company_id, project_id
  on public.photos
  for each row
  execute function public.photos_align_from_report();

create or replace function public.photos_lock_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.project_id is distinct from old.project_id
    or new.field_log_id is distinct from old.field_log_id
    or new.storage_path is distinct from old.storage_path
    or new.content_type is distinct from old.content_type
    or new.byte_size is distinct from old.byte_size
    or new.uploaded_by is distinct from old.uploaded_by
  then
    raise exception 'Photo identity and file metadata cannot be changed';
  end if;

  if old.status = 'ready' and new.status is distinct from old.status then
    raise exception 'Ready photos cannot change status';
  end if;

  if old.status = 'failed' and new.status is distinct from old.status then
    raise exception 'Failed photos cannot change status';
  end if;

  if old.status = 'pending'
    and new.status is distinct from old.status
    and new.status not in ('ready', 'failed')
  then
    raise exception 'Pending photos can only become ready or failed';
  end if;

  return new;
end;
$$;

revoke all on function public.photos_lock_identity() from public;
revoke all on function public.photos_lock_identity() from anon;
revoke all on function public.photos_lock_identity() from authenticated;

drop trigger if exists photos_lock_identity on public.photos;
create trigger photos_lock_identity
  before update
  on public.photos
  for each row
  execute function public.photos_lock_identity();

revoke all on table public.photos from anon, authenticated, public;
grant select, insert on table public.photos to authenticated;
grant update (status, caption) on table public.photos to authenticated;

alter table public.photos enable row level security;

drop policy if exists photos_select_same_company on public.photos;
create policy photos_select_same_company
  on public.photos
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = photos.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists photos_insert_same_company on public.photos;
create policy photos_insert_same_company
  on public.photos
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and status = 'pending'
    and exists (
      select 1 from public.projects as p
      where p.id = photos.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists photos_update_same_company on public.photos;
create policy photos_update_same_company
  on public.photos
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = photos.project_id
        and p.company_id = public.current_company_id()
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = photos.project_id
        and p.company_id = public.current_company_id()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.project_photo_object_allowed(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
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
  if coalesce(array_length(parts, 1), 0) < 4 then
    return false;
  end if;

  if parts[1] is distinct from company::text then
    return false;
  end if;

  return exists (
    select 1
    from public.projects as p
    where p.id::text = parts[2]
      and p.company_id = company
  );
end;
$$;

revoke all on function public.project_photo_object_allowed(text) from public;
revoke all on function public.project_photo_object_allowed(text) from anon;
grant execute on function public.project_photo_object_allowed(text) to authenticated;

drop policy if exists job_photos_select_same_company on storage.objects;
create policy job_photos_select_same_company
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'job-photos'
    and public.project_photo_object_allowed(name)
  );

drop policy if exists job_photos_insert_same_company on storage.objects;
create policy job_photos_insert_same_company
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'job-photos'
    and public.project_photo_object_allowed(name)
  );

-- ---------------------------------------------------------------------------
-- 4) Schedule activities and one-level predecessor links. Not a task due date.
-- ---------------------------------------------------------------------------

create table if not exists public.schedule_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid not null references public.projects (id),
  name text not null,
  notes text,
  start_date date,
  finish_date date,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'done', 'held')
  ),
  trade_name text,
  is_milestone boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_activities_name_present check (char_length(trim(name)) > 0),
  constraint schedule_activities_finish_not_before_start check (
    start_date is null or finish_date is null or finish_date >= start_date
  )
);

create index if not exists schedule_activities_project_start_idx
  on public.schedule_activities (project_id, start_date, sort_order);

create or replace function public.schedule_activities_align_company_from_project()
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
    raise exception 'Schedule activity job does not exist';
  end if;

  new.company_id := project_company;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.schedule_activities_align_company_from_project() from public;
revoke all on function public.schedule_activities_align_company_from_project() from anon;
revoke all on function public.schedule_activities_align_company_from_project() from authenticated;

drop trigger if exists schedule_activities_align_company_from_project on public.schedule_activities;
create trigger schedule_activities_align_company_from_project
  before insert or update of project_id, company_id
  on public.schedule_activities
  for each row
  execute function public.schedule_activities_align_company_from_project();

create or replace function public.schedule_activities_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.schedule_activities_touch_updated_at() from public;
revoke all on function public.schedule_activities_touch_updated_at() from anon;
revoke all on function public.schedule_activities_touch_updated_at() from authenticated;

drop trigger if exists schedule_activities_touch_updated_at on public.schedule_activities;
create trigger schedule_activities_touch_updated_at
  before update
  on public.schedule_activities
  for each row
  execute function public.schedule_activities_touch_updated_at();

revoke all on table public.schedule_activities from anon, authenticated, public;
grant select, insert, update, delete on table public.schedule_activities to authenticated;

alter table public.schedule_activities enable row level security;

drop policy if exists schedule_activities_select_same_company on public.schedule_activities;
create policy schedule_activities_select_same_company
  on public.schedule_activities
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = schedule_activities.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists schedule_activities_insert_same_company on public.schedule_activities;
create policy schedule_activities_insert_same_company
  on public.schedule_activities
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = schedule_activities.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists schedule_activities_update_same_company on public.schedule_activities;
create policy schedule_activities_update_same_company
  on public.schedule_activities
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = schedule_activities.project_id
        and p.company_id = public.current_company_id()
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = schedule_activities.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists schedule_activities_delete_same_company on public.schedule_activities;
create policy schedule_activities_delete_same_company
  on public.schedule_activities
  for delete
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = schedule_activities.project_id
        and p.company_id = public.current_company_id()
    )
  );

create table if not exists public.schedule_dependencies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid not null references public.projects (id),
  activity_id uuid not null references public.schedule_activities (id) on delete cascade,
  predecessor_id uuid not null references public.schedule_activities (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint schedule_dependencies_not_self check (activity_id <> predecessor_id),
  constraint schedule_dependencies_unique unique (activity_id, predecessor_id)
);

create index if not exists schedule_dependencies_activity_id_idx
  on public.schedule_dependencies (activity_id);

create or replace function public.schedule_dependencies_align_and_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_project uuid;
  activity_company uuid;
  predecessor_project uuid;
begin
  select a.project_id, a.company_id
    into activity_project, activity_company
  from public.schedule_activities as a
  where a.id = new.activity_id;

  if activity_project is null then
    raise exception 'Schedule activity does not exist';
  end if;

  select a.project_id
    into predecessor_project
  from public.schedule_activities as a
  where a.id = new.predecessor_id;

  if predecessor_project is distinct from activity_project then
    raise exception 'Predecessor must be on the same job';
  end if;

  new.project_id := activity_project;
  new.company_id := activity_company;

  if exists (
    with recursive chain as (
      select new.predecessor_id as id
      union
      select d.predecessor_id
      from public.schedule_dependencies as d
      inner join chain as c on d.activity_id = c.id
    )
    select 1 from chain where id = new.activity_id
  ) then
    raise exception 'Schedule dependency would create a cycle';
  end if;

  return new;
end;
$$;

revoke all on function public.schedule_dependencies_align_and_guard() from public;
revoke all on function public.schedule_dependencies_align_and_guard() from anon;
revoke all on function public.schedule_dependencies_align_and_guard() from authenticated;

drop trigger if exists schedule_dependencies_align_and_guard on public.schedule_dependencies;
create trigger schedule_dependencies_align_and_guard
  before insert or update of activity_id, predecessor_id, company_id, project_id
  on public.schedule_dependencies
  for each row
  execute function public.schedule_dependencies_align_and_guard();

revoke all on table public.schedule_dependencies from anon, authenticated, public;
grant select, insert, delete on table public.schedule_dependencies to authenticated;

alter table public.schedule_dependencies enable row level security;

drop policy if exists schedule_dependencies_select_same_company on public.schedule_dependencies;
create policy schedule_dependencies_select_same_company
  on public.schedule_dependencies
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = schedule_dependencies.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists schedule_dependencies_insert_same_company on public.schedule_dependencies;
create policy schedule_dependencies_insert_same_company
  on public.schedule_dependencies
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = schedule_dependencies.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists schedule_dependencies_delete_same_company on public.schedule_dependencies;
create policy schedule_dependencies_delete_same_company
  on public.schedule_dependencies
  for delete
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.projects as p
      where p.id = schedule_dependencies.project_id
        and p.company_id = public.current_company_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 5) A to-do may record which daily report it came from. It is not an issue.
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column if not exists source_field_log_id uuid references public.field_logs (id) on delete set null,
  add column if not exists trade_name text,
  add column if not exists location_text text,
  add column if not exists responsible_name text;

create index if not exists tasks_source_field_log_id_idx
  on public.tasks (source_field_log_id);

create or replace function public.tasks_require_same_job_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_field_log_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.field_logs as f
    where f.id = new.source_field_log_id
      and f.project_id = new.project_id
  ) then
    raise exception 'To-do source report must belong to the same job';
  end if;

  return new;
end;
$$;

revoke all on function public.tasks_require_same_job_report() from public;
revoke all on function public.tasks_require_same_job_report() from anon;
revoke all on function public.tasks_require_same_job_report() from authenticated;

drop trigger if exists tasks_require_same_job_report on public.tasks;
create trigger tasks_require_same_job_report
  before insert or update of source_field_log_id, project_id
  on public.tasks
  for each row
  execute function public.tasks_require_same_job_report();

commit;
