-- SITEPM Week 4 — Auth linkage, signup trigger, company-scoped RLS
-- Additive: does not DROP/TRUNCATE Week 3 tables or delete SITEPM Test Company.
-- Do not run until reviewed.
-- Single transaction: any error before COMMIT rolls back the entire migration.

begin;

-- ---------------------------------------------------------------------------
-- 0) Safety: orphan profiles from Week 3 cannot become NOT NULL auth_user_id
--    Companies without an Auth owner (e.g. SITEPM Test Company) are left as-is.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.profiles where auth_user_id is null) then
    raise exception
      'profiles.auth_user_id has NULL rows. Link or remove those test profiles in Table Editor, then re-run. Existing companies without an Auth owner are not modified.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.auth_user_id is not null
      and not exists (select 1 from auth.users u where u.id = p.auth_user_id)
  ) then
    raise exception
      'profiles.auth_user_id points at a missing auth.users row. Fix that in Table Editor, then re-run.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Tie profiles to Auth
-- ---------------------------------------------------------------------------
alter table public.profiles
  alter column auth_user_id set not null;

create unique index if not exists profiles_auth_user_id_key
  on public.profiles (auth_user_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_auth_user_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users (id)
      on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) current_company_id() — company comes only from auth.uid()
--    SECURITY DEFINER so this SELECT on profiles does not re-enter RLS
--    (which would recurse if policies on profiles called this function).
--    search_path is fixed so a caller cannot shadow public.profiles.
--    The query is filtered to auth.uid() only; it never takes a company id
--    from the client.
-- ---------------------------------------------------------------------------
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id
  from public.profiles as p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_company_id() from public;
revoke all on function public.current_company_id() from anon;
grant execute on function public.current_company_id() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Signup: new Auth user → new company + owner profile
--    SECURITY DEFINER: Auth insert must write companies/profiles despite RLS
--    (the new user has no profile yet, so current_company_id() would be null).
--    search_path fixed. EXECUTE revoked from API roles; only the trigger
--    (table owner / supabase auth) should invoke this.
--    raw_user_meta_data.company_name / full_name are set by the signup form.
--    This never assigns an existing company (SITEPM Test Company stays unowned).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
  company_name text;
  person_name text;
begin
  company_name := nullif(trim(coalesce(new.raw_user_meta_data->>'company_name', '')), '');
  person_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');

  if company_name is null then
    company_name := 'New company';
  end if;

  insert into public.companies (name)
  values (company_name)
  returning id into new_company_id;

  insert into public.profiles (
    auth_user_id,
    company_id,
    full_name,
    email,
    role
  )
  values (
    new.id,
    new_company_id,
    person_name,
    new.email,
    'owner'
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4) Freeze company_id, auth_user_id, role on profile updates (client cannot
--    move themselves to another company or promote their role).
-- ---------------------------------------------------------------------------
create or replace function public.profiles_prevent_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_id is distinct from old.company_id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.role is distinct from old.role then
    raise exception 'Cannot change company_id, auth_user_id, or role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_identity_change on public.profiles;
create trigger profiles_prevent_identity_change
  before update on public.profiles
  for each row
  execute function public.profiles_prevent_identity_change();

-- ---------------------------------------------------------------------------
-- 5) Table privileges: anon gets nothing. authenticated cannot insert
--    companies/profiles (trigger does that). Profile updates limited to
--    name/email columns.
-- ---------------------------------------------------------------------------
revoke all on table public.companies from anon, authenticated, public;
revoke all on table public.profiles from anon, authenticated, public;
revoke all on table public.projects from anon, authenticated, public;
revoke all on table public.tasks from anon, authenticated, public;
revoke all on table public.field_logs from anon, authenticated, public;

grant select, update on table public.companies to authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, email) on table public.profiles to authenticated;
grant select, insert, update on table public.projects to authenticated;
grant select, insert, update on table public.tasks to authenticated;
grant select, insert, update on table public.field_logs to authenticated;

-- ---------------------------------------------------------------------------
-- 6) RLS stays enabled. No anon/public policies.
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.field_logs enable row level security;

-- companies
drop policy if exists companies_select_own on public.companies;
create policy companies_select_own
  on public.companies
  for select
  to authenticated
  using (id = public.current_company_id());

drop policy if exists companies_update_own on public.companies;
create policy companies_update_own
  on public.companies
  for update
  to authenticated
  using (id = public.current_company_id())
  with check (id = public.current_company_id());

-- profiles
drop policy if exists profiles_select_same_company on public.profiles;
create policy profiles_select_same_company
  on public.profiles
  for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- projects
drop policy if exists projects_select_same_company on public.projects;
create policy projects_select_same_company
  on public.projects
  for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists projects_insert_same_company on public.projects;
create policy projects_insert_same_company
  on public.projects
  for insert
  to authenticated
  with check (company_id = public.current_company_id());

drop policy if exists projects_update_same_company on public.projects;
create policy projects_update_same_company
  on public.projects
  for update
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- tasks
drop policy if exists tasks_select_same_company on public.tasks;
create policy tasks_select_same_company
  on public.tasks
  for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists tasks_insert_same_company on public.tasks;
create policy tasks_insert_same_company
  on public.tasks
  for insert
  to authenticated
  with check (company_id = public.current_company_id());

drop policy if exists tasks_update_same_company on public.tasks;
create policy tasks_update_same_company
  on public.tasks
  for update
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- field_logs
drop policy if exists field_logs_select_same_company on public.field_logs;
create policy field_logs_select_same_company
  on public.field_logs
  for select
  to authenticated
  using (company_id = public.current_company_id());

drop policy if exists field_logs_insert_same_company on public.field_logs;
create policy field_logs_insert_same_company
  on public.field_logs
  for insert
  to authenticated
  with check (company_id = public.current_company_id());

drop policy if exists field_logs_update_same_company on public.field_logs;
create policy field_logs_update_same_company
  on public.field_logs
  for update
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

commit;
