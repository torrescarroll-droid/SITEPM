begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Existing status keys remain compatible with the deployed baseline.
alter table public.schedule_activities drop constraint schedule_activities_status_check;
alter table public.schedule_activities add constraint schedule_activities_status_check check(status in ('not_started','confirmed','in_progress','done','delayed','held','cancelled'));
alter table public.schedule_activities
 add column revision integer not null default 1 check(revision>0),
 add column activity_type text not null default 'work' check(activity_type in ('work','inspection','delivery','equipment','milestone')),
 add column all_day boolean not null default true,
 add column start_time time,
 add column finish_time time,
 add column timezone text not null default 'UTC',
 add column start_at timestamptz,
 add column finish_at timestamptz,
 add column source_task_id uuid references public.tasks(id) on delete set null,
 add constraint schedule_activity_company_identity unique(id,company_id);
create index schedule_company_dates on public.schedule_activities(company_id,start_date,finish_date);
create index schedule_source_task on public.schedule_activities(source_task_id) where source_task_id is not null;

create table public.schedule_resources (
 id uuid primary key,
 company_id uuid not null references public.companies(id),
 name text not null check(length(trim(name)) between 1 and 200),
 company_name text check(length(company_name)<=200),
 trade_name text check(length(trade_name)<=100),
 resource_type text not null check(resource_type in ('employee','subcontractor_company','subcontractor','crew','supplier','external')),
 email text check(length(email)<=254),
 phone text check(length(phone)<=80),
 notes text check(length(notes)<=5000),
 active boolean not null default true,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,company_id)
);
create index schedule_resources_company on public.schedule_resources(company_id,active,name);
create table public.schedule_assignments (
 company_id uuid not null references public.companies(id),
 activity_id uuid not null,
 resource_id uuid not null,
 expected_workers integer check(expected_workers between 0 and 10000),
 primary key(activity_id,resource_id),
 foreign key(activity_id,company_id) references public.schedule_activities(id,company_id),
 foreign key(resource_id,company_id) references public.schedule_resources(id,company_id)
);
create index schedule_assignments_resource on public.schedule_assignments(company_id,resource_id,activity_id);
create table public.schedule_history (
 id bigint generated always as identity primary key,
 company_id uuid not null references public.companies(id),
 activity_id uuid not null references public.schedule_activities(id),
 actor_id uuid references auth.users(id),
 occurred_at timestamptz not null default now(),
 change_type text not null,
 before_record jsonb,
 after_record jsonb
);
create index schedule_history_activity on public.schedule_history(company_id,activity_id,occurred_at);
create table public.schedule_requests (
 company_id uuid not null references public.companies(id),
 actor_id uuid not null references auth.users(id),
 request_id uuid not null,
 payload jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(company_id,actor_id,request_id)
);

alter table public.schedule_resources enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.schedule_history enable row level security;
alter table public.schedule_requests enable row level security;
revoke all on public.schedule_resources,public.schedule_assignments,public.schedule_history,public.schedule_requests from public,anon,authenticated;
grant select,insert,update on public.schedule_resources to authenticated;
grant select,insert,delete on public.schedule_assignments to authenticated;
grant select on public.schedule_history to authenticated;
grant select,insert on public.schedule_requests to authenticated;
create policy resources_read on public.schedule_resources for select to authenticated using(company_id=(select public.current_company_id()));
create policy resources_create on public.schedule_resources for insert to authenticated with check(company_id=(select public.current_company_id()));
create policy resources_edit on public.schedule_resources for update to authenticated using(company_id=(select public.current_company_id())) with check(company_id=(select public.current_company_id()));
create policy assignments_read on public.schedule_assignments for select to authenticated using(company_id=(select public.current_company_id()));
create policy assignments_create on public.schedule_assignments for insert to authenticated with check(company_id=(select public.current_company_id()));
create policy assignments_remove on public.schedule_assignments for delete to authenticated using(company_id=(select public.current_company_id()));
create policy history_read on public.schedule_history for select to authenticated using(company_id=(select public.current_company_id()));
create policy requests_read on public.schedule_requests for select to authenticated using(company_id=(select public.current_company_id()) and actor_id=(select auth.uid()));
create policy requests_create on public.schedule_requests for insert to authenticated with check(company_id=(select public.current_company_id()) and actor_id=(select auth.uid()));
-- No hard deletes: cancellation retains operational memory, task links and dependencies.
revoke delete on public.schedule_activities from authenticated;

create function public.schedule_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_TABLE_NAME='schedule_resources' then
  if TG_OP='UPDATE' then
   if new.company_id<>old.company_id or new.id<>old.id then raise exception 'Resource identity cannot change'; end if;
   new.revision=old.revision+1; new.updated_at=now();
  else new.revision=1; end if;
  return new;
 end if;
 if TG_OP='UPDATE' then
  if new.project_id<>old.project_id or new.company_id<>old.company_id or new.id<>old.id then raise exception 'Activity identity cannot change'; end if;
  new.revision=old.revision+1;
 else new.revision=1; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception using errcode='22023',message='Choose a valid IANA timezone'; end if;
 if new.source_task_id is not null and not exists(select 1 from public.tasks where id=new.source_task_id and company_id=new.company_id and project_id=new.project_id) then raise exception using errcode='42501',message='Task must belong to this job'; end if;
 if new.is_milestone or new.activity_type='milestone' then
  new.is_milestone=true;new.activity_type='milestone';
  if new.finish_date is distinct from new.start_date then raise exception using errcode='22023',message='Milestones must occupy one day'; end if;
 end if;
 if new.all_day then
  if new.start_time is not null or new.finish_time is not null then raise exception using errcode='22023',message='All-day work cannot have times'; end if;
  new.start_at=new.start_date::timestamp at time zone new.timezone;
  new.finish_at=(coalesce(new.finish_date,new.start_date)+1)::timestamp at time zone new.timezone;
 else
  if new.start_date is null or new.finish_date is null or new.start_time is null or new.finish_time is null then raise exception using errcode='22023',message='Timed work needs both dates and times'; end if;
  new.start_at=(new.start_date+new.start_time) at time zone new.timezone;
  new.finish_at=(new.finish_date+new.finish_time) at time zone new.timezone;
  if new.finish_at<=new.start_at or (new.start_at at time zone new.timezone)<>(new.start_date+new.start_time) or (new.finish_at at time zone new.timezone)<>(new.finish_date+new.finish_time) then raise exception using errcode='22023',message='Invalid time range or daylight-saving gap'; end if;
 end if;
 if length(new.name)>200 or length(new.notes)>10000 or length(new.trade_name)>100 then raise exception using errcode='22023',message='Activity text too long'; end if;
 return new;
end $$;
revoke all on function public.schedule_guard() from public,anon,authenticated;
create trigger schedule_guard before insert or update on public.schedule_activities for each row execute function public.schedule_guard();
create trigger schedule_resource_guard before insert or update on public.schedule_resources for each row execute function public.schedule_guard();

-- Narrow definer trigger writes immutable history only; it is not an exposed RPC.
create function public.schedule_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.schedule_activities; begin
 if TG_TABLE_NAME='schedule_activities' then
  insert into public.schedule_history(company_id,activity_id,actor_id,change_type,before_record,after_record)
  values(new.company_id,new.id,auth.uid(),lower(TG_OP),case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 else
  select * into a from public.schedule_activities where id=coalesce(new.activity_id,old.activity_id);
  insert into public.schedule_history(company_id,activity_id,actor_id,change_type,before_record,after_record)
  values(a.company_id,a.id,auth.uid(),'assignment_'||lower(TG_OP),case when TG_OP='DELETE' then to_jsonb(old) else null end,case when TG_OP='INSERT' then to_jsonb(new) else null end);
 end if;
 return null;
end $$;
revoke all on function public.schedule_audit() from public,anon,authenticated;
create trigger schedule_audit after insert or update on public.schedule_activities for each row execute function public.schedule_audit();
create trigger schedule_assignment_audit after insert or delete on public.schedule_assignments for each row execute function public.schedule_audit();

-- Keep dependency changes in the same append-only history stream.
create function public.schedule_dependency_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.schedule_activities; begin
 select * into a from public.schedule_activities where id=coalesce(new.activity_id,old.activity_id);
 insert into public.schedule_history(company_id,activity_id,actor_id,change_type,before_record,after_record)
 values(a.company_id,a.id,auth.uid(),'dependency_'||lower(TG_OP),case when TG_OP='DELETE' then to_jsonb(old) else null end,case when TG_OP='INSERT' then to_jsonb(new) else null end);
 return null;
end $$;
revoke all on function public.schedule_dependency_audit() from public,anon,authenticated;
create trigger schedule_dependency_audit after insert or delete on public.schedule_dependencies for each row execute function public.schedule_dependency_audit();

create function public.schedule_request_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.actor_id is distinct from auth.uid() or new.company_id is distinct from public.current_company_id() then raise exception using errcode='42501',message='Invalid receipt scope'; end if;
 if new.payload->>'kind'='activity' then
  if not exists(select 1 from public.schedule_activities where id=(new.result->>'id')::uuid and company_id=new.company_id and revision=(new.result->>'revision')::integer) then raise exception using errcode='42501',message='Receipt activity unavailable'; end if;
 elsif new.payload->>'kind'='resource' then
  if not exists(select 1 from public.schedule_resources where id=(new.result->>'id')::uuid and company_id=new.company_id and revision=(new.result->>'revision')::integer) then raise exception using errcode='42501',message='Receipt resource unavailable'; end if;
 else raise exception using errcode='22023',message='Invalid receipt kind'; end if;
 if new.payload->'record'->>'id' is distinct from new.result->>'id' then raise exception using errcode='22023',message='Invalid receipt identity'; end if;
 return new;
end $$;
revoke all on function public.schedule_request_guard() from public,anon,authenticated;
create trigger schedule_request_guard before insert on public.schedule_requests for each row execute function public.schedule_request_guard();

create function public.save_construction_schedule(p_request_id uuid,p_kind text,p_record jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare c uuid=public.current_company_id(); actor uuid=auth.uid(); id uuid=(p_record->>'id')::uuid;
 old_revision integer; result jsonb; prior public.schedule_requests; item jsonb; job uuid; pred uuid; preds jsonb;
 payload jsonb=jsonb_build_object('kind',p_kind,'record',p_record);
begin
 if actor is null or c is null then raise exception using errcode='42501',message='Company authentication required'; end if;
 if p_request_id is null or id is null then raise exception using errcode='22023',message='Submission identity required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c::text||actor::text||p_request_id::text,0));
 select * into prior from public.schedule_requests where company_id=c and actor_id=actor and request_id=p_request_id;
 if found then
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
   if not exists(select 1 from public.schedule_resources where schedule_resources.id=(item->>'resource_id')::uuid and company_id=c and active) then raise exception using errcode='42501',message='Choose active resources from your company'; end if;
   -- Validate even unchanged selections; do not generate false unassign/reassign events.
   if not exists(select 1 from public.schedule_assignments s where s.activity_id=id and s.resource_id=(item->>'resource_id')::uuid) then
    insert into public.schedule_assignments(company_id,activity_id,resource_id,expected_workers) values(c,id,(item->>'resource_id')::uuid,nullif(item->>'expected_workers','')::integer);
   end if;
  end loop;
 else raise exception using errcode='22023',message='Unknown record type'; end if;
 result=jsonb_build_object('id',id,'revision',old_revision);
 insert into public.schedule_requests(company_id,actor_id,request_id,payload,result) values(c,actor,p_request_id,payload,result);
 return result;
end $$;
revoke all on function public.save_construction_schedule(uuid,text,jsonb) from public,anon;
grant execute on function public.save_construction_schedule(uuid,text,jsonb) to authenticated;
commit;
