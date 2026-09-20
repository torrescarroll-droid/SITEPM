-- SITEPM Week 5 remainder — Field log policies: company + project relationship
-- Additive. Does not DROP tables. No anonymous policies.
-- company_id is aligned from the parent project, never trusted from the client.
-- Single transaction: any error before COMMIT rolls back.
-- Does not grant DELETE (Field Logs MVP is create + list; UPDATE stays granted).

begin;

create or replace function public.field_logs_align_company_from_project()
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
    raise exception 'Field log project does not exist';
  end if;

  new.company_id := project_company;
  return new;
end;
$$;

revoke all on function public.field_logs_align_company_from_project() from public;
revoke all on function public.field_logs_align_company_from_project() from anon;
revoke all on function public.field_logs_align_company_from_project() from authenticated;

drop trigger if exists field_logs_align_company_from_project on public.field_logs;
create trigger field_logs_align_company_from_project
  before insert or update of project_id, company_id
  on public.field_logs
  for each row
  execute function public.field_logs_align_company_from_project();

revoke all on table public.field_logs from anon, authenticated, public;
grant select, insert, update on table public.field_logs to authenticated;

alter table public.field_logs enable row level security;

drop policy if exists field_logs_select_same_company on public.field_logs;
create policy field_logs_select_same_company
  on public.field_logs
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = field_logs.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists field_logs_insert_same_company on public.field_logs;
create policy field_logs_insert_same_company
  on public.field_logs
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = field_logs.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists field_logs_update_same_company on public.field_logs;
create policy field_logs_update_same_company
  on public.field_logs
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = field_logs.project_id
        and p.company_id = public.current_company_id()
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = field_logs.project_id
        and p.company_id = public.current_company_id()
    )
  );

commit;
