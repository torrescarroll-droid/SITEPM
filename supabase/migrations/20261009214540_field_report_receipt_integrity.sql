-- Receipt provenance hardening. Additive follow-up; never replay the local baseline on production.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Existing receipts may have been client-forged; preserve them without trusting them.
alter table public.field_report_saves add column trusted boolean not null default false;
create role sitepm_field_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant sitepm_field_writer to postgres;
create schema sitepm_field_internal;
revoke all on schema sitepm_field_internal from public,anon,authenticated,service_role;
grant usage on schema sitepm_field_internal,public to sitepm_field_writer;
-- Managed Auth cannot be delegated. This private bridge delegates identity only.
create function sitepm_field_internal.actor_id() returns uuid language sql stable security definer set search_path='' as $$ select auth.uid() $$;
revoke all on function sitepm_field_internal.actor_id() from public,anon,authenticated,service_role;
grant execute on function sitepm_field_internal.actor_id(),public.current_company_id() to sitepm_field_writer;
revoke all on public.field_report_saves from public,anon,authenticated,service_role;
-- Normalize any column-level client grants as well as table grants.
do $$ declare c record;r text;begin
 for c in select attname from pg_catalog.pg_attribute where attrelid='public.field_report_saves'::regclass and attnum>0 and not attisdropped loop
  foreach r in array array['public','anon','authenticated','service_role'] loop
   execute format('revoke select(%I),insert(%I),update(%I),references(%I) on public.field_report_saves from %I',c.attname,c.attname,c.attname,c.attname,r);
  end loop;
 end loop;
end $$;
grant select on public.field_report_saves to authenticated;
drop policy field_report_saves_insert on public.field_report_saves;
grant select,insert on public.field_report_saves to sitepm_field_writer;
create policy field_receipt_writer_read on public.field_report_saves for select to sitepm_field_writer using(company_id=public.current_company_id() and actor_id=sitepm_field_internal.actor_id());
create policy field_receipt_writer_insert on public.field_report_saves for insert to sitepm_field_writer with check(trusted and company_id=public.current_company_id() and actor_id=sitepm_field_internal.actor_id() and exists(select 1 from public.field_logs f where f.id=report_id and f.project_id=field_report_saves.project_id and f.company_id=field_report_saves.company_id and f.revision=field_report_saves.revision));
grant select(id,company_id) on public.projects to sitepm_field_writer;
grant select(id,auth_user_id,company_id) on public.profiles to sitepm_field_writer;
create policy field_writer_projects on public.projects for select to sitepm_field_writer using(company_id=public.current_company_id());
create policy field_writer_profile on public.profiles for select to sitepm_field_writer using(auth_user_id=sitepm_field_internal.actor_id() and company_id=public.current_company_id());
grant select(id,revision,project_id,company_id),insert on public.field_logs to sitepm_field_writer;
grant update(log_date,issue_flag,notes,work_performed,deliveries,equipment,delays,site_events,safety_notes,tomorrow,location_text) on public.field_logs to sitepm_field_writer;
create policy field_writer_reports_read on public.field_logs for select to sitepm_field_writer using(company_id=public.current_company_id() and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id()));
create policy field_writer_reports_insert on public.field_logs for insert to sitepm_field_writer with check(company_id=public.current_company_id() and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id()));
create policy field_writer_reports_update on public.field_logs for update to sitepm_field_writer using(company_id=public.current_company_id() and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id())) with check(company_id=public.current_company_id() and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id()));
grant select(field_log_id,company_id,project_id),insert,delete on public.field_log_crews to sitepm_field_writer;
create policy field_writer_crews_read on public.field_log_crews for select to sitepm_field_writer using(company_id=public.current_company_id());
create policy field_writer_crews_insert on public.field_log_crews for insert to sitepm_field_writer with check(company_id=public.current_company_id() and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id()));
create policy field_writer_crews_delete on public.field_log_crews for delete to sitepm_field_writer using(company_id=public.current_company_id());
grant insert on public.tasks to sitepm_field_writer;
create policy field_writer_followup on public.tasks for insert to sitepm_field_writer with check(company_id=public.current_company_id() and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id()));
create or replace function public.save_field_report(
  p_request_id uuid, p_project_id uuid, p_report_id uuid, p_expected_revision integer,
  p_report jsonb, p_crews jsonb, p_follow_up text default null
) returns table (report_id uuid, project_id uuid, revision integer, replayed boolean)
language plpgsql security definer set search_path = '' set row_security = on as $$
declare
  v_company uuid := public.current_company_id();
  v_actor uuid := sitepm_field_internal.actor_id();
  v_profile uuid;
  v_id uuid;
  v_revision integer;
  v_payload jsonb;
  v_receipt public.field_report_saves%rowtype;
  v_row jsonb;
  v_date date;
  v_count integer;
  v_order integer := 0;
begin
  if v_actor is null or v_company is null then raise exception using errcode='42501', message='Company access required'; end if;
  if p_request_id is null or p_project_id is null then raise exception using errcode='22023', message='Submission and job are required'; end if;
  if not exists (select 1 from public.projects p where p.id=p_project_id and p.company_id=v_company) then
    raise exception using errcode='42501', message='Job unavailable';
  end if;
  v_payload := jsonb_build_object('project', p_project_id, 'report_id', p_report_id, 'expected_revision', p_expected_revision, 'report', p_report, 'crews', p_crews, 'follow_up', p_follow_up);
  -- Serializes simultaneous requests with the same key before reading the receipt.
  perform pg_advisory_xact_lock(hashtextextended(v_company::text || p_request_id::text, 0));
  select * into v_receipt from public.field_report_saves s where s.company_id=v_company and s.request_id=p_request_id;
  if found then
    if not v_receipt.trusted then raise exception using errcode='22023', message='Legacy submission receipt cannot confirm persistence. Review the report before starting a new submission.'; end if;
    if v_receipt.actor_id is distinct from v_actor then raise exception using errcode='42501', message='Submission unavailable'; end if;
    if v_receipt.payload is distinct from v_payload then raise exception using errcode='22023', message='Submission changed; use a new submission key'; end if;
    return query select v_receipt.report_id, v_receipt.project_id, v_receipt.revision, true;
    return;
  end if;
  if jsonb_typeof(p_report) is distinct from 'object' or jsonb_typeof(p_crews) is distinct from 'array' then
    raise exception using errcode='22023', message='Invalid report or crews';
  end if;
  if jsonb_array_length(p_crews)>50 then raise exception using errcode='22023', message='At most 50 crews per report'; end if;
  if not exists (select 1 from jsonb_each(p_report) x where x.key in ('notes','work_performed','deliveries','delays') and length(trim(x.value #>> '{}'))>0) then
    raise exception using errcode='22023', message='Record work, a delay, a delivery, or a note';
  end if;
  if exists (select 1 from jsonb_each(p_report) x where x.key not in ('notes','work_performed','deliveries','equipment','delays','site_events','safety_notes','tomorrow','location_text','log_date','issue_flag')
    or (x.key<>'issue_flag' and jsonb_typeof(x.value) not in ('string','null')) or length(x.value #>> '{}')>20000) then
    raise exception using errcode='22023', message='Invalid report fields';
  end if;
  if coalesce(p_report->>'log_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception using errcode='22023', message='Invalid report date'; end if;
  v_date := (p_report->>'log_date')::date;
  if jsonb_typeof(p_report->'issue_flag') is distinct from 'boolean' then raise exception using errcode='22023', message='Invalid attention flag'; end if;
  if length(p_follow_up)>500 or (p_report_id is not null and p_follow_up is not null) then raise exception using errcode='22023', message='Invalid follow-up'; end if;
  select p.id into v_profile from public.profiles p where p.auth_user_id=v_actor and p.company_id=v_company;
  if v_profile is null then raise exception using errcode='42501', message='Profile unavailable'; end if;
  if p_report_id is null then
    if p_expected_revision is not null then raise exception using errcode='22023', message='Unexpected report revision'; end if;
    insert into public.field_logs(company_id, project_id, created_by, log_date, issue_flag, notes, work_performed, deliveries, equipment, delays, site_events, safety_notes, tomorrow, location_text)
    values (v_company,p_project_id,v_profile,v_date,(p_report->>'issue_flag')::boolean,p_report->>'notes',p_report->>'work_performed',p_report->>'deliveries',p_report->>'equipment',p_report->>'delays',p_report->>'site_events',p_report->>'safety_notes',p_report->>'tomorrow',p_report->>'location_text')
    returning field_logs.id, field_logs.revision into v_id,v_revision;
  else
    select f.id, f.revision into v_id,v_revision from public.field_logs f where f.id=p_report_id and f.company_id=v_company and f.project_id=p_project_id for update;
    if not found then raise exception using errcode='42501', message='Report unavailable'; end if;
    if p_expected_revision is distinct from v_revision then raise exception using errcode='40001', message='Report changed since you opened it. Review the latest report before saving.'; end if;
    update public.field_logs f set log_date=v_date, issue_flag=(p_report->>'issue_flag')::boolean,
      notes=p_report->>'notes',work_performed=p_report->>'work_performed',deliveries=p_report->>'deliveries',equipment=p_report->>'equipment',delays=p_report->>'delays',site_events=p_report->>'site_events',safety_notes=p_report->>'safety_notes',tomorrow=p_report->>'tomorrow',location_text=p_report->>'location_text'
    where f.id=v_id returning f.revision into v_revision;
    if not found then raise exception using errcode='42501', message='Report update rejected'; end if;
  end if;
  delete from public.field_log_crews c where c.field_log_id=v_id and c.company_id=v_company;
  for v_row in select value from jsonb_array_elements(p_crews) loop
    if jsonb_typeof(v_row) is distinct from 'object' or coalesce(length(trim(v_row->>'tradeName')),0)=0 or length(v_row->>'tradeName')>200 or length(v_row->>'companyName')>200 then
      raise exception using errcode='22023', message='Invalid crew trade or company';
    end if;
    v_count := (v_row->>'workerCount')::integer;
    insert into public.field_log_crews(company_id,project_id,field_log_id,company_name,trade_name,worker_count,sort_order)
    values (v_company,p_project_id,v_id,nullif(trim(v_row->>'companyName'),''),trim(v_row->>'tradeName'),v_count,v_order);
    v_order := v_order+1;
  end loop;
  if nullif(trim(p_follow_up),'') is not null then
    insert into public.tasks(company_id,project_id,title,description,status,priority,ai_suggested,source_field_log_id,location_text)
    values (v_company,p_project_id,trim(p_follow_up),p_report->>'delays','open','medium',false,v_id,p_report->>'location_text');
  end if;
  insert into public.field_report_saves(company_id,request_id,actor_id,report_id,project_id,revision,payload,trusted)
  values (v_company,p_request_id,v_actor,v_id,p_project_id,v_revision,v_payload,true);
  return query select v_id,p_project_id,v_revision,false;
end;
$$;

-- No table/schema ownership or client membership. Only this bounded RPC can use receipt INSERT.
grant create on schema public to sitepm_field_writer;
alter function public.save_field_report(uuid,uuid,uuid,integer,jsonb,jsonb,text) owner to sitepm_field_writer;
revoke create on schema public from sitepm_field_writer;
revoke all on function public.save_field_report(uuid,uuid,uuid,integer,jsonb,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.save_field_report(uuid,uuid,uuid,integer,jsonb,jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
