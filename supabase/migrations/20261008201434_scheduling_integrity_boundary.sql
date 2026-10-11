begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Refuse to adopt an already cyclic legacy graph; preserve data for explicit repair.
do $$ begin
 if exists(
  with recursive walk(origin,node) as (
   select activity_id,predecessor_id from public.schedule_dependencies
   union
   select w.origin,d.predecessor_id from walk w join public.schedule_dependencies d on d.activity_id=w.node
  ) select 1 from walk where origin=node
 ) then raise exception 'Existing scheduling dependency cycle requires review before hardening'; end if;
end $$;

-- The only application writer is a bounded RPC owned by a non-login, non-owner,
-- non-BYPASSRLS role. No client role can SET ROLE to it. SECURITY DEFINER is
-- necessary to remove direct DML without breaking authorized transactional saves.
do $$ begin
 if not exists(select 1 from pg_catalog.pg_roles where rolname='sitepm_schedule_writer') then
  create role sitepm_schedule_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
 end if;
 if exists(select 1 from pg_catalog.pg_roles where rolname='sitepm_schedule_writer' and (rolcanlogin or rolinherit or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
 or exists(select 1 from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid=m.member where r.rolname='sitepm_schedule_writer')
 or pg_catalog.pg_has_role('authenticated','sitepm_schedule_writer','MEMBER')
 or pg_catalog.pg_has_role('anon','sitepm_schedule_writer','MEMBER')
 or pg_catalog.pg_has_role('authenticator','sitepm_schedule_writer','MEMBER') then
  raise exception 'Unsafe scheduling writer role configuration';
 end if;
end $$;
-- Migration administrator only; not granted to any API or login client role.
grant sitepm_schedule_writer to postgres;
grant usage on schema public to sitepm_schedule_writer;
grant execute on function public.current_company_id() to sitepm_schedule_writer;
-- Supabase's postgres role can call auth.uid(), but cannot delegate USAGE on
-- the managed auth schema. Bridge only that identity operation, not Auth data.
create schema sitepm_schedule_internal;
revoke all on schema sitepm_schedule_internal from public,anon,authenticated,service_role;
grant usage on schema sitepm_schedule_internal to sitepm_schedule_writer;
create function sitepm_schedule_internal.actor_id() returns uuid
 language sql stable security definer set search_path='' as $$ select auth.uid() $$;
revoke all on function sitepm_schedule_internal.actor_id() from public,anon,authenticated,service_role;
grant execute on function sitepm_schedule_internal.actor_id() to sitepm_schedule_writer;
grant select(id,company_id) on public.projects to sitepm_schedule_writer;
grant select(id,project_id,company_id) on public.tasks to sitepm_schedule_writer;
grant select(id,auth_user_id) on public.profiles to sitepm_schedule_writer;
create policy schedule_writer_projects on public.projects for select to sitepm_schedule_writer using(company_id=(select public.current_company_id()));
create policy schedule_writer_tasks on public.tasks for select to sitepm_schedule_writer using(company_id=(select public.current_company_id()));
create policy schedule_writer_profile on public.profiles for select to sitepm_schedule_writer using(auth_user_id=(select sitepm_schedule_internal.actor_id()));

revoke insert,update,delete,truncate,references,trigger on public.schedule_activities,public.schedule_dependencies,public.schedule_resources,public.schedule_assignments,public.schedule_requests from public,anon,authenticated,service_role;
grant select,insert,update on public.schedule_activities,public.schedule_resources to sitepm_schedule_writer;
grant select,insert,delete on public.schedule_assignments,public.schedule_dependencies to sitepm_schedule_writer;
grant select,insert on public.schedule_requests to sitepm_schedule_writer;
create policy schedule_writer_activities on public.schedule_activities for all to sitepm_schedule_writer
 using(company_id=(select public.current_company_id()) and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id()))
 with check(company_id=(select public.current_company_id()) and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id()));
create policy schedule_writer_resources on public.schedule_resources for all to sitepm_schedule_writer
 using(company_id=(select public.current_company_id())) with check(company_id=(select public.current_company_id()));
create policy schedule_writer_assignments on public.schedule_assignments for all to sitepm_schedule_writer
 using(company_id=(select public.current_company_id())) with check(company_id=(select public.current_company_id()));
create policy schedule_writer_dependencies on public.schedule_dependencies for all to sitepm_schedule_writer
 using(company_id=(select public.current_company_id()) and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id()))
 with check(company_id=(select public.current_company_id()) and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id()));
create policy schedule_writer_requests on public.schedule_requests for all to sitepm_schedule_writer
 using(company_id=(select public.current_company_id()) and actor_id=(select sitepm_schedule_internal.actor_id()))
 with check(company_id=(select public.current_company_id()) and actor_id=(select sitepm_schedule_internal.actor_id()));

create or replace function public.schedule_request_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.actor_id is distinct from sitepm_schedule_internal.actor_id() or new.company_id is distinct from public.current_company_id() then raise exception using errcode='42501',message='Invalid receipt scope'; end if;
 if new.payload->>'kind'='activity' then
  if not exists(select 1 from public.schedule_activities where id=(new.result->>'id')::uuid and company_id=new.company_id and revision=(new.result->>'revision')::integer) then raise exception using errcode='42501',message='Receipt activity unavailable'; end if;
 elsif new.payload->>'kind'='resource' then
  if not exists(select 1 from public.schedule_resources where id=(new.result->>'id')::uuid and company_id=new.company_id and revision=(new.result->>'revision')::integer) then raise exception using errcode='42501',message='Receipt resource unavailable'; end if;
 else raise exception using errcode='22023',message='Invalid receipt kind'; end if;
 if new.payload->'record'->>'id' is distinct from new.result->>'id' then raise exception using errcode='22023',message='Invalid receipt identity'; end if;
 return new;
end $$;

-- Never trust receipts that could have been written by the old authenticated grant.
-- Preserve them as evidence, but require reconciliation instead of claiming success.
alter table public.schedule_requests add column trusted boolean not null default false;

create function public.schedule_relationship_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare c uuid; resource_active boolean;
begin
 c=case when TG_OP='DELETE' then old.company_id else new.company_id end;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception using errcode='0A000',message='Scheduling writes require READ COMMITTED';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule:'||c::text,0));
 if TG_TABLE_NAME='schedule_assignments' then
 if TG_OP='UPDATE' and (new.company_id is distinct from old.company_id or new.activity_id is distinct from old.activity_id or new.resource_id is distinct from old.resource_id) then
  raise exception using errcode='22023',message='Assignment identity cannot change';
 end if;
 if TG_OP<>'DELETE' then
  select active into resource_active from public.schedule_resources where id=new.resource_id and company_id=new.company_id for share;
  if resource_active is distinct from true then
   raise exception using errcode='42501',message='New assignments require an active company resource';
  end if;
 end if;
 end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end $$;
revoke all on function public.schedule_relationship_guard() from public,anon,authenticated,service_role;
create trigger schedule_relationship_guard before insert or update or delete on public.schedule_assignments
 for each row execute function public.schedule_relationship_guard();
-- Dependency INSERT guard below locks before performing its cycle query.
create trigger schedule_relationship_guard before delete on public.schedule_dependencies
 for each row execute function public.schedule_relationship_guard();

create function public.schedule_relationship_revision() returns trigger
language plpgsql security invoker set search_path='' as $$
declare activity uuid; c uuid;
begin
 activity=case when TG_OP='DELETE' then old.activity_id else new.activity_id end;
 c=case when TG_OP='DELETE' then old.company_id else new.company_id end;
 -- schedule_guard increments revision; no transaction marker clients could forge.
 update public.schedule_activities set updated_at=now() where id=activity and company_id=c;
 if not found then raise exception using errcode='42501',message='Assignment activity unavailable'; end if;
 return null;
end $$;
revoke all on function public.schedule_relationship_revision() from public,anon,authenticated,service_role;
create trigger schedule_relationship_revision after insert or update or delete on public.schedule_assignments
 for each row execute function public.schedule_relationship_revision();
create trigger schedule_relationship_revision after insert or delete on public.schedule_dependencies
 for each row execute function public.schedule_relationship_revision();

create or replace function public.schedule_dependencies_align_and_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
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

  if current_setting('transaction_isolation')<>'read committed' then
    raise exception using errcode='0A000',message='Scheduling writes require READ COMMITTED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule:'||activity_company::text,0));

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


create or replace function public.save_construction_schedule(p_request_id uuid,p_kind text,p_record jsonb) returns jsonb
language plpgsql security definer set search_path='' set row_security=on as $$
#variable_conflict use_variable
declare c uuid=public.current_company_id(); actor uuid=sitepm_schedule_internal.actor_id(); id uuid=(p_record->>'id')::uuid;
 old_revision integer; result jsonb; prior public.schedule_requests; item jsonb; job uuid; pred uuid; preds jsonb;
 payload jsonb=jsonb_build_object('kind',p_kind,'record',p_record);
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='0A000',message='Scheduling writes require READ COMMITTED'; end if;
 if actor is null or c is null then raise exception using errcode='42501',message='Company authentication required'; end if;
 if p_request_id is null or id is null then raise exception using errcode='22023',message='Submission identity required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c::text||actor::text||p_request_id::text,0));
 select * into prior from public.schedule_requests where company_id=c and actor_id=actor and request_id=p_request_id;
 if found then
  if not prior.trusted then raise exception using errcode='40001',message='Legacy receipt is unverified; reload and reconcile'; end if;
  if prior.payload<>payload then raise exception using errcode='22023',message='Submission changed; use a new request'; end if;
  return prior.result;
 end if;
 -- Company-wide lock also serializes dependency graph changes and row creation identities.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule:'||c::text,0));
 if p_kind='resource' then
  select revision into old_revision from public.schedule_resources where schedule_resources.id=id and company_id=c for update;
  if found then
   if old_revision is distinct from (p_record->>'revision')::integer then raise exception using errcode='40001',message='Resource changed; reload latest'; end if;
   update public.schedule_resources set name=p_record->>'name',company_name=nullif(p_record->>'company_name',''),trade_name=nullif(p_record->>'trade_name',''),resource_type=p_record->>'resource_type',email=nullif(p_record->>'email',''),phone=nullif(p_record->>'phone',''),notes=nullif(p_record->>'notes',''),active=(p_record->>'active')::boolean where schedule_resources.id=id returning revision into old_revision;
  else
   if p_record->>'revision' is not null then raise exception using errcode='40001',message='Resource unavailable'; end if;
   insert into public.schedule_resources(id,company_id,name,company_name,trade_name,resource_type,email,phone,notes,active) values(id,c,p_record->>'name',nullif(p_record->>'company_name',''),nullif(p_record->>'trade_name',''),p_record->>'resource_type',nullif(p_record->>'email',''),nullif(p_record->>'phone',''),nullif(p_record->>'notes',''),(p_record->>'active')::boolean) returning revision into old_revision;
  end if;
 elsif p_kind='activity' then
  job=(p_record->>'project_id')::uuid;pred=nullif(p_record->>'predecessor_id','')::uuid;
  preds=coalesce(p_record->'predecessor_ids',case when pred is null then '[]'::jsonb else jsonb_build_array(pred) end);
  if jsonb_typeof(preds)<>'array' or jsonb_array_length(preds)>100 then raise exception using errcode='22023',message='Invalid predecessors'; end if;
  if not exists(select 1 from public.projects where projects.id=job and company_id=c) then raise exception using errcode='42501',message='Job unavailable'; end if;
  if p_record->>'start_date' is null or p_record->>'finish_date' is null then raise exception using errcode='22023',message='Choose start and finish dates'; end if;
  if coalesce(jsonb_typeof(p_record->'assignments'),'missing')<>'array' or jsonb_array_length(p_record->'assignments')>100 then raise exception using errcode='22023',message='Invalid assignments'; end if;
  if (select count(*) from jsonb_array_elements(p_record->'assignments'))<>(select count(distinct x->>'resource_id') from jsonb_array_elements(p_record->'assignments') x) then raise exception using errcode='22023',message='Duplicate assignments'; end if;
  if (select count(*) from jsonb_array_elements_text(preds))<>(select count(distinct value) from jsonb_array_elements_text(preds)) then raise exception using errcode='22023',message='Duplicate predecessors'; end if;
  select revision into old_revision from public.schedule_activities where schedule_activities.id=id and company_id=c and project_id=job for update;
  if found then
   if old_revision is distinct from (p_record->>'revision')::integer then raise exception using errcode='40001',message='Activity changed; reload latest'; end if;
   update public.schedule_activities set name=p_record->>'name',notes=nullif(p_record->>'notes',''),start_date=(p_record->>'start_date')::date,finish_date=(p_record->>'finish_date')::date,status=p_record->>'status',trade_name=nullif(p_record->>'trade_name',''),is_milestone=(p_record->>'activity_type'='milestone'),activity_type=p_record->>'activity_type',all_day=(p_record->>'all_day')::boolean,start_time=nullif(p_record->>'start_time','')::time,finish_time=nullif(p_record->>'finish_time','')::time,timezone=p_record->>'timezone',source_task_id=nullif(p_record->>'source_task_id','')::uuid where schedule_activities.id=id returning revision into old_revision;
  else
   if p_record->>'revision' is not null then raise exception using errcode='40001',message='Activity unavailable'; end if;
   insert into public.schedule_activities(id,company_id,project_id,created_by,name,notes,start_date,finish_date,status,trade_name,is_milestone,activity_type,all_day,start_time,finish_time,timezone,source_task_id)
   values(id,c,job,(select profiles.id from public.profiles where auth_user_id=actor),p_record->>'name',nullif(p_record->>'notes',''),(p_record->>'start_date')::date,(p_record->>'finish_date')::date,p_record->>'status',nullif(p_record->>'trade_name',''),p_record->>'activity_type'='milestone',p_record->>'activity_type',(p_record->>'all_day')::boolean,nullif(p_record->>'start_time','')::time,nullif(p_record->>'finish_time','')::time,p_record->>'timezone',nullif(p_record->>'source_task_id','')::uuid) returning revision into old_revision;
  end if;
  delete from public.schedule_dependencies where activity_id=id and company_id=c and predecessor_id not in (select value::uuid from jsonb_array_elements_text(preds));
  for pred in select value::uuid from jsonb_array_elements_text(preds) loop
   if not exists(select 1 from public.schedule_dependencies d where d.activity_id=id and d.predecessor_id=pred) then
    insert into public.schedule_dependencies(company_id,project_id,activity_id,predecessor_id) values(c,job,id,pred);
   end if;
  end loop;
  delete from public.schedule_assignments s where s.activity_id=id and s.company_id=c and not exists(select 1 from jsonb_array_elements(p_record->'assignments') x where (x->>'resource_id')::uuid=s.resource_id and nullif(x->>'expected_workers','')::integer is not distinct from s.expected_workers);
  for item in select value from jsonb_array_elements(p_record->'assignments') loop
   -- Validate even unchanged selections; do not generate false unassign/reassign events.
   if not exists(select 1 from public.schedule_assignments s where s.activity_id=id and s.resource_id=(item->>'resource_id')::uuid) then
    insert into public.schedule_assignments(company_id,activity_id,resource_id,expected_workers) values(c,id,(item->>'resource_id')::uuid,nullif(item->>'expected_workers','')::integer);
   end if;
  end loop;
 else raise exception using errcode='22023',message='Unknown record type'; end if;
 if p_kind='activity' then select revision into old_revision from public.schedule_activities where schedule_activities.id=id and company_id=c; end if;
 result=jsonb_build_object('id',id,'revision',old_revision);
 insert into public.schedule_requests(company_id,actor_id,request_id,payload,result,trusted) values(c,actor,p_request_id,payload,result,true);
 return result;
end $$;

-- Ownership transfer needs CREATE only during this migration transaction.
grant create on schema public to sitepm_schedule_writer;
alter function public.save_construction_schedule(uuid,text,jsonb) owner to sitepm_schedule_writer;
revoke create on schema public from sitepm_schedule_writer;
revoke all on function public.save_construction_schedule(uuid,text,jsonb) from public,anon,service_role;
grant execute on function public.save_construction_schedule(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
