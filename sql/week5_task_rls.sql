-- SITEPM Week 5 — Task policies: company + project relationship
-- Additive. Does not DROP tables. No anonymous policies.
-- company_id is aligned from the parent project, never trusted from the client.
-- Single transaction: any error before COMMIT rolls back.

begin;

create or replace function public.tasks_align_company_from_project()
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
    raise exception 'Task project does not exist';
  end if;

  new.company_id := project_company;
  return new;
end;
$$;

revoke all on function public.tasks_align_company_from_project() from public;
revoke all on function public.tasks_align_company_from_project() from anon;
revoke all on function public.tasks_align_company_from_project() from authenticated;

drop trigger if exists tasks_align_company_from_project on public.tasks;
create trigger tasks_align_company_from_project
  before insert or update of project_id, company_id
  on public.tasks
  for each row
  execute function public.tasks_align_company_from_project();

revoke all on table public.tasks from anon, authenticated, public;
grant select, insert, update, delete on table public.tasks to authenticated;

alter table public.tasks enable row level security;

drop policy if exists tasks_select_same_company on public.tasks;
create policy tasks_select_same_company
  on public.tasks
  for select
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = tasks.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists tasks_insert_same_company on public.tasks;
create policy tasks_insert_same_company
  on public.tasks
  for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = tasks.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists tasks_update_same_company on public.tasks;
create policy tasks_update_same_company
  on public.tasks
  for update
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = tasks.project_id
        and p.company_id = public.current_company_id()
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = tasks.project_id
        and p.company_id = public.current_company_id()
    )
  );

drop policy if exists tasks_delete_same_company on public.tasks;
create policy tasks_delete_same_company
  on public.tasks
  for delete
  to authenticated
  using (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.projects as p
      where p.id = tasks.project_id
        and p.company_id = public.current_company_id()
    )
  );

commit;
