begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Exclusive adoption boundary: no old uploader can publish between backfill and revocation.
lock table public.documents in access exclusive mode;
alter table public.documents drop constraint documents_filename_safe;
alter table public.documents add constraint documents_filename_safe check(filename ~ '^[A-Za-z0-9._ -]+\.(pdf|jpg|jpeg|png|docx|xlsx|pptx)$');
alter table public.documents add constraint documents_supported_mime check(content_type = case lower(substring(filename from '\.([^.]+)$'))
 when 'pdf' then 'application/pdf' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg' when 'png' then 'image/png'
 when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
 when 'xlsx' then 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 when 'pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation' else null end);
alter table public.documents add constraint documents_scoped_identity unique(id,company_id,project_id);
create index document_capacity_scope on public.documents(company_id) include(byte_size);
create table public.document_families(
 id uuid primary key, company_id uuid not null references public.companies(id),project_id uuid not null references public.projects(id),
 title text not null check(length(trim(title)) between 1 and 200),category text not null check(category in ('contract','plans','specifications','schedule','selections','change_order','other')),
 collection text not null default '' check(length(collection)<=100),trade text not null default '' check(length(trade)<=100),notes text not null default '' check(length(notes)<=5000),
 current_document_id uuid,archived boolean not null default false,revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,company_id,project_id)
);
create index document_families_scope on public.document_families(company_id,project_id,archived,updated_at desc,id);
create index document_current_lookup on public.document_families(company_id,project_id,current_document_id) where not archived;
create table public.document_versions(
 document_id uuid primary key,family_id uuid not null,company_id uuid not null,project_id uuid not null,
 version_number integer not null check(version_number>0),issue_label text not null default '' check(length(issue_label)<=100),issued_on date,
 verified_at timestamptz,processing_started_at timestamptz,processing_state text not null default 'not_processed' check(processing_state in ('not_processed','processing','searchable','unsupported','retry_required')),
 unique(family_id,version_number),unique(family_id,document_id),
 foreign key(document_id,company_id,project_id) references public.documents(id,company_id,project_id),
 foreign key(family_id,company_id,project_id) references public.document_families(id,company_id,project_id)
);
create index document_processing_scope on public.document_versions(company_id,processing_started_at) where processing_started_at is not null;
alter table public.document_families add constraint document_current_membership foreign key(id,current_document_id) references public.document_versions(family_id,document_id) deferrable initially deferred;
create table public.document_upload_attempts(
 request_id uuid primary key,actor_id uuid not null references auth.users(id),company_id uuid not null,project_id uuid not null,
 document_id uuid not null unique references public.documents(id),payload jsonb not null,
 verified_at timestamptz,created_at timestamptz not null default now(),
 foreign key(document_id,company_id,project_id) references public.documents(id,company_id,project_id)
);
create index document_attempt_actor on public.document_upload_attempts(company_id,actor_id,created_at desc);
create table public.document_events(
 id bigint generated always as identity primary key,company_id uuid not null,project_id uuid not null,family_id uuid not null,
 actor_id uuid references auth.users(id),kind text not null,details jsonb not null default '{}'::jsonb,document_id uuid references public.documents(id),occurred_at timestamptz not null default now(),
 foreign key(family_id,company_id,project_id) references public.document_families(id,company_id,project_id)
);
create index document_events_family on public.document_events(company_id,family_id,occurred_at desc,id);
create index document_processing_rate on public.document_events(company_id,actor_id,occurred_at desc) where kind='processing_requested';
create table public.document_links(
 id uuid primary key,family_id uuid not null,document_id uuid not null references public.documents(id),company_id uuid not null,project_id uuid not null,
 task_id uuid references public.tasks(id),activity_id uuid references public.schedule_activities(id),field_log_id uuid references public.field_logs(id),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 check(num_nonnulls(task_id,activity_id,field_log_id)=1),
 foreign key(document_id,company_id,project_id) references public.documents(id,company_id,project_id)
);
-- Typed scoped keys keep references valid even if a work record is later moved.
alter table public.tasks add constraint document_task_scope unique(id,company_id,project_id);
alter table public.schedule_activities add constraint document_activity_scope unique(id,company_id,project_id);
alter table public.field_logs add constraint document_report_scope unique(id,company_id,project_id);
alter table public.document_links add constraint document_task_reference foreign key(task_id,company_id,project_id) references public.tasks(id,company_id,project_id);
alter table public.document_links add constraint document_activity_reference foreign key(activity_id,company_id,project_id) references public.schedule_activities(id,company_id,project_id);
alter table public.document_links add constraint document_report_reference foreign key(field_log_id,company_id,project_id) references public.field_logs(id,company_id,project_id);
alter table public.document_links add constraint document_link_version_membership foreign key(family_id,document_id) references public.document_versions(family_id,document_id);
create unique index document_link_task on public.document_links(document_id,task_id) where task_id is not null;
create unique index document_link_activity on public.document_links(document_id,activity_id) where activity_id is not null;
create unique index document_link_report on public.document_links(document_id,field_log_id) where field_log_id is not null;
create index document_link_scope on public.document_links(company_id,project_id);
create index document_link_family on public.document_links(company_id,family_id,created_at desc);
create index document_task_reference_lookup on public.document_links(task_id,company_id,project_id) where task_id is not null;
create index document_activity_reference_lookup on public.document_links(activity_id,company_id,project_id) where activity_id is not null;
create index document_report_reference_lookup on public.document_links(field_log_id,company_id,project_id) where field_log_id is not null;
-- Preserve every canonical identity/path. No guess-based grouping or invented prior history.
insert into public.document_families(id,company_id,project_id,title,category,current_document_id,created_at,updated_at)
 select id,company_id,project_id,filename,document_type,case when status='ready' then id end,created_at,created_at from public.documents;
insert into public.document_versions(document_id,family_id,company_id,project_id,version_number,processing_state)
 select d.id,d.id,d.company_id,d.project_id,1,case when exists(select 1 from public.document_extractions e where e.document_id=d.id) then 'searchable' else 'not_processed' end from public.documents d;

-- Flush deferred current-membership checks before enabling RLS/altering adopted tables.
set constraints document_current_membership immediate;

create role sitepm_document_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role sitepm_document_verifier nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant sitepm_document_writer to postgres;
create schema sitepm_documents_private;
revoke all on schema sitepm_documents_private from public,anon,authenticated,service_role;
grant usage on schema sitepm_documents_private,public to sitepm_document_writer;
create function sitepm_documents_private.actor_id() returns uuid language sql stable security definer set search_path='' as $$select auth.uid()$$;
revoke all on function sitepm_documents_private.actor_id() from public,anon,authenticated,service_role;
grant execute on function sitepm_documents_private.actor_id(),public.current_company_id() to sitepm_document_writer;
grant usage on schema public to sitepm_document_verifier;
grant select(id,company_id) on public.projects to sitepm_document_writer;
grant select(id,project_id,company_id) on public.tasks,public.schedule_activities,public.field_logs to sitepm_document_writer;
grant select(id,auth_user_id) on public.profiles to sitepm_document_writer;
create policy document_writer_projects on public.projects for select to sitepm_document_writer using(company_id=(select public.current_company_id()));
create policy document_writer_tasks on public.tasks for select to sitepm_document_writer using(company_id=(select public.current_company_id()));
create policy document_writer_activities on public.schedule_activities for select to sitepm_document_writer using(company_id=(select public.current_company_id()));
create policy document_writer_reports on public.field_logs for select to sitepm_document_writer using(company_id=(select public.current_company_id()));
create policy document_writer_profile on public.profiles for select to sitepm_document_writer using(auth_user_id=(select sitepm_documents_private.actor_id()));
revoke insert,update,delete,truncate,references,trigger on public.documents from public,anon,authenticated,service_role;
drop policy documents_insert_same_company on public.documents;
drop policy documents_update_status_same_company on public.documents;
-- Column-level legacy status grant is independent from the table-level grant.
revoke update(status) on public.documents from authenticated;
grant select,insert,update(status) on public.documents to sitepm_document_writer;
create policy document_writer_documents on public.documents for all to sitepm_document_writer using(company_id=(select public.current_company_id())) with check(company_id=(select public.current_company_id()) and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id()));
do $$declare t text;begin
 foreach t in array array['document_families','document_versions','document_upload_attempts','document_events','document_links'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy company_read on public.%I for select to authenticated using(company_id=(select public.current_company_id()))',t);
  execute format('create policy bounded_writer on public.%I for all to sitepm_document_writer using(company_id=(select public.current_company_id())) with check(company_id=(select public.current_company_id()) and exists(select 1 from public.projects p where p.id=project_id and p.company_id=public.current_company_id()))',t);
 end loop;
end $$;
-- Upload request payloads are private to their authenticated creator.
drop policy company_read on public.document_upload_attempts;
create policy attempt_read on public.document_upload_attempts for select to authenticated using(company_id=(select public.current_company_id()) and actor_id=(select auth.uid()));
grant select,insert,update on public.document_families to sitepm_document_writer;
grant select,insert,update(processing_state,processing_started_at,verified_at) on public.document_versions to sitepm_document_writer;
grant select,insert,update(verified_at) on public.document_upload_attempts to sitepm_document_writer;
grant select,insert on public.document_events to sitepm_document_writer;
grant usage on sequence public.document_events_id_seq to sitepm_document_writer;
grant select,insert,delete on public.document_links to sitepm_document_writer;
create function public.document_family_guard() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if TG_OP='UPDATE' then
  if (new.id,new.company_id,new.project_id) is distinct from (old.id,old.company_id,old.project_id) then raise exception 'Document family identity is immutable';end if;
  new.revision=old.revision+1;new.updated_at=now();
 end if;
 if new.current_document_id is not null and not exists(select 1 from public.documents d where d.id=new.current_document_id and d.status='ready' and d.company_id=new.company_id and d.project_id=new.project_id) then raise exception 'Current version must be ready';end if;
 return new;
end$$;
revoke all on function public.document_family_guard() from public,anon,authenticated,service_role;
create trigger document_family_guard before insert or update on public.document_families for each row execute function public.document_family_guard();
create function public.document_link_guard() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if not exists(select 1 from public.documents d where d.id=new.document_id and d.status='ready' and d.company_id=new.company_id and d.project_id=new.project_id) or
 (new.task_id is not null and not exists(select 1 from public.tasks where id=new.task_id and company_id=new.company_id and project_id=new.project_id)) or
 (new.activity_id is not null and not exists(select 1 from public.schedule_activities where id=new.activity_id and company_id=new.company_id and project_id=new.project_id)) or
 (new.field_log_id is not null and not exists(select 1 from public.field_logs where id=new.field_log_id and company_id=new.company_id and project_id=new.project_id)) then raise exception using errcode='42501',message='Document and work must belong to the same job';end if;
 return new;end$$;
revoke all on function public.document_link_guard() from public,anon,authenticated,service_role;
create trigger document_link_guard before insert on public.document_links for each row execute function public.document_link_guard();

create function public.begin_document_upload(p_request uuid,p_record jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare c uuid=public.current_company_id();actor uuid=sitepm_documents_private.actor_id();prior public.document_upload_attempts;d uuid=(p_record->>'id')::uuid;f uuid=coalesce(nullif(p_record->>'family_id','')::uuid,d);job uuid=(p_record->>'project_id')::uuid;v integer;path text;
begin
 if c is null or actor is null or p_request is null or d is null then raise exception using errcode='42501',message='Company authentication required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('document-upload:'||p_request::text,0));
 select * into prior from public.document_upload_attempts where request_id=p_request;
 if found then
  if prior.actor_id<>actor or prior.payload<>p_record then raise exception using errcode='22023',message='Request identity changed';end if;
  return jsonb_build_object('document_id',prior.document_id,'family_id',f,'storage_path',prior.payload->>'storage_path','verified',prior.verified_at is not null);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('document-company:'||c::text,0));
 -- Reserve the bucket maximum for every unverified file. Storage permission probes
 -- do not reliably include final size; never trust a client-declared size for quota.
 -- Only a trusted byte-verification receipt releases the unused reservation.
 if (select coalesce(sum(case when exists(select 1 from public.document_versions v where v.document_id=d.id and v.verified_at is not null) then d.byte_size else 20971520 end),0) from public.documents d where d.company_id=c)+20971520>2147483648 then raise exception 'Company document capacity reached';end if;
 if (select count(*) from public.document_upload_attempts where actor_id=actor and created_at>now()-interval '1 hour')>=50 then raise exception 'Upload limit reached; retry later';end if;
 if not exists(select 1 from public.projects where id=job and company_id=c) then raise exception using errcode='42501',message='Job unavailable';end if;
 if p_record->>'sha256' !~ '^[0-9a-f]{64}$' or p_record->>'sha256' is null then raise exception 'File checksum required';end if;
 path=c::text||'/'||job::text||'/'||d::text||'/'||(p_record->>'filename');
 if (p_record->>'storage_path') is distinct from path then raise exception 'Invalid object identity';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('document-family:'||f::text,0));
 if p_record->>'family_id' is null or p_record->>'family_id'='' then
  insert into public.document_families(id,company_id,project_id,title,category,collection,trade,notes) values(f,c,job,p_record->>'title',p_record->>'category',coalesce(p_record->>'collection',''),coalesce(p_record->>'trade',''),coalesce(p_record->>'notes',''));
 else
  perform 1 from public.document_families where id=f and project_id=job and company_id=c and not archived for update;
  if not found then raise exception using errcode='42501',message='Document group unavailable';end if;
 end if;
 select coalesce(max(version_number),0)+1 into v from public.document_versions where family_id=f;
 insert into public.documents(id,company_id,project_id,filename,storage_path,document_type,uploaded_by,content_type,byte_size,sha256,status)
 values(d,c,job,p_record->>'filename',path,p_record->>'category',(select id from public.profiles where auth_user_id=actor),p_record->>'content_type',(p_record->>'byte_size')::bigint,p_record->>'sha256','pending');
 insert into public.document_versions(document_id,family_id,company_id,project_id,version_number,issue_label,issued_on) values(d,f,c,job,v,coalesce(p_record->>'issue_label',''),nullif(p_record->>'issued_on','')::date);
 insert into public.document_upload_attempts(request_id,actor_id,company_id,project_id,document_id,payload) values(p_request,actor,c,job,d,p_record);
 insert into public.document_events(company_id,project_id,family_id,actor_id,kind,document_id) values(c,job,f,actor,'upload_started',d);
 return jsonb_build_object('document_id',d,'family_id',f,'storage_path',path,'verified',false);
end$$;

-- Only a separately provisioned trusted server connection can attest stored bytes.
-- It supplies authenticated subject in a transaction-local JWT context. No table access.
create function public.verify_document_upload(p_request uuid,p_sha text,p_size bigint) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare a public.document_upload_attempts;d public.documents;f uuid;actor uuid=sitepm_documents_private.actor_id();begin
 select * into a from public.document_upload_attempts where request_id=p_request and actor_id=actor for update;
 if not found then raise exception using errcode='42501',message='Upload unavailable';end if;
 select * into d from public.documents where id=a.document_id;
 if d.sha256 is distinct from p_sha or d.byte_size is distinct from p_size then raise exception 'Stored file identity mismatch';end if;
 select family_id into f from public.document_versions where document_id=d.id;
 if a.verified_at is null then
  update public.documents set status='ready' where id=d.id;
  update public.document_versions set verified_at=now() where document_id=d.id;
  update public.document_upload_attempts set verified_at=now() where request_id=p_request;
  insert into public.document_events(company_id,project_id,family_id,actor_id,kind,document_id) values(a.company_id,a.project_id,f,actor,'upload_verified',d.id);
 end if;
 return jsonb_build_object('document_id',d.id,'family_id',f,'verified',true);
end$$;
create function public.request_document_processing(p_document uuid) returns void language plpgsql security definer set search_path='' set row_security=on as $$
declare c uuid=public.current_company_id();actor uuid=sitepm_documents_private.actor_id();v public.document_versions;
begin
 if c is null or actor is null then raise exception using errcode='42501',message='Company authentication required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('document-processing:'||c::text,0));
 -- Match promotion/link lock order: family before version, avoiding indexing/promotion deadlocks.
 perform 1 from public.document_families where id=(select family_id from public.document_versions where document_id=p_document) and company_id=c and not archived for update;
 if not found then raise exception using errcode='42501',message='PDF unavailable';end if;
 select dv.* into v from public.document_versions dv join public.documents d on d.id=dv.document_id join public.document_families f on f.id=dv.family_id where dv.document_id=p_document and dv.company_id=c and d.status='ready' and d.content_type='application/pdf' and not f.archived for update of dv;
 if not found then raise exception using errcode='42501',message='PDF unavailable';end if;
 if (select count(*) from public.document_versions where company_id=c and processing_started_at>now()-interval '2 minutes')>=2 or v.processing_started_at>now()-interval '2 minutes' then raise exception 'Text indexing is busy; retry later';end if;
 if (select count(*) from public.document_events where actor_id=actor and kind='processing_requested' and occurred_at>now()-interval '1 hour')>=20 then raise exception 'Text indexing limit reached; retry later';end if;
 update public.document_versions set processing_state='processing',processing_started_at=now() where document_id=p_document;
 insert into public.document_events(company_id,project_id,family_id,actor_id,kind,document_id) values(c,v.project_id,v.family_id,actor,'processing_requested',p_document);
end$$;
create function public.document_processing_result(p_document uuid,p_state text) returns void language plpgsql security definer set search_path='' set row_security=on as $$begin
 if p_state not in ('not_processed','searchable','unsupported','retry_required') then raise exception 'Invalid processing state';end if;
 update public.document_versions set processing_state=p_state,processing_started_at=null where document_id=p_document and company_id=public.current_company_id();
 if not found then raise exception using errcode='42501',message='Document unavailable';end if;
end$$;
create function public.manage_project_document(p_family uuid,p_revision integer,p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' set row_security=on as $$
declare f public.document_families;d uuid;actor uuid=sitepm_documents_private.actor_id();l public.document_links;begin
 select * into f from public.document_families where id=p_family and company_id=public.current_company_id() for update;
 if not found or actor is null then raise exception using errcode='42501',message='Document unavailable';end if;
 if f.revision is distinct from p_revision then raise exception using errcode='40001',message='Document changed; reload latest';end if;
 if p_action='promote' then
  d=(p_data->>'document_id')::uuid;
  if f.archived or not exists(select 1 from public.document_versions v join public.documents doc on doc.id=v.document_id where v.family_id=f.id and doc.id=d and doc.status='ready') then raise exception 'Choose a verified ready version';end if;
  update public.document_families set current_document_id=d where id=f.id;
 elsif p_action='metadata' then
  update public.document_families set title=p_data->>'title',category=p_data->>'category',collection=coalesce(p_data->>'collection',''),trade=coalesce(p_data->>'trade',''),notes=coalesce(p_data->>'notes','') where id=f.id;
 elsif p_action in ('archive','restore') then update public.document_families set archived=(p_action='archive') where id=f.id;
 elsif p_action='link' then
  d=(p_data->>'document_id')::uuid;
  if f.archived or not exists(select 1 from public.document_versions where document_id=d and family_id=f.id) then raise exception 'Version unavailable';end if;
  insert into public.document_links(id,family_id,document_id,company_id,project_id,task_id,activity_id,field_log_id,created_by)
   values((p_data->>'id')::uuid,f.id,d,f.company_id,f.project_id,nullif(p_data->>'task_id','')::uuid,nullif(p_data->>'activity_id','')::uuid,nullif(p_data->>'field_log_id','')::uuid,actor) returning * into l;
  update public.document_families set updated_at=now() where id=f.id;
 elsif p_action='unlink' then
  delete from public.document_links where id=(p_data->>'id')::uuid and document_id in (select document_id from public.document_versions where family_id=f.id) returning * into l;
  if not found then raise exception 'Link unavailable';end if;
  d=l.document_id;update public.document_families set updated_at=now() where id=f.id;
 else raise exception 'Unknown document action';end if;
 insert into public.document_events(company_id,project_id,family_id,actor_id,kind,document_id,details) values(f.company_id,f.project_id,f.id,actor,p_action,d,jsonb_build_object('before',to_jsonb(f),'after',(select to_jsonb(x) from public.document_families x where x.id=f.id),'work_reference',case when p_action in ('link','unlink') then to_jsonb(l) else null end));
 return (select jsonb_build_object('id',id,'revision',revision) from public.document_families where id=f.id);
end$$;
-- Function-owner transfer requires CREATE only inside this transaction.
grant create on schema public to sitepm_document_writer;
alter function public.begin_document_upload(uuid,jsonb) owner to sitepm_document_writer;
alter function public.verify_document_upload(uuid,text,bigint) owner to sitepm_document_writer;
alter function public.request_document_processing(uuid) owner to sitepm_document_writer;
alter function public.document_processing_result(uuid,text) owner to sitepm_document_writer;
alter function public.manage_project_document(uuid,integer,text,jsonb) owner to sitepm_document_writer;
revoke create on schema public from sitepm_document_writer;
revoke all on function public.begin_document_upload(uuid,jsonb),public.verify_document_upload(uuid,text,bigint),public.request_document_processing(uuid),public.document_processing_result(uuid,text),public.manage_project_document(uuid,integer,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.begin_document_upload(uuid,jsonb),public.manage_project_document(uuid,integer,text,jsonb) to authenticated;
grant execute on function public.verify_document_upload(uuid,text,bigint),public.request_document_processing(uuid),public.document_processing_result(uuid,text) to sitepm_document_verifier;

create function public.document_storage_allowed(p_path text,p_write boolean) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.documents d join public.document_versions v on v.document_id=d.id join public.document_families f on f.id=v.family_id
  where d.storage_path=p_path and d.company_id=public.current_company_id() and not f.archived and
   ((not p_write and d.status='ready') or (d.status='pending' and exists(select 1 from public.document_upload_attempts a where a.document_id=d.id and a.actor_id=auth.uid() and a.verified_at is null)))
 )
$$;
revoke all on function public.document_storage_allowed(text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.document_storage_allowed(text,boolean) to authenticated;
drop policy project_documents_select_same_company on storage.objects;
drop policy project_documents_insert_same_company on storage.objects;
create policy document_registered_read on storage.objects for select to authenticated using(bucket_id='project-documents' and public.document_storage_allowed(name,false));
create policy document_registered_upload on storage.objects for insert to authenticated with check(bucket_id='project-documents' and public.document_storage_allowed(name,true));
update storage.buckets set allowed_mime_types=array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'] where id='project-documents';
-- Add current/archived filtering to existing chunk RLS: applies before ranking even to direct reads.
drop policy if exists document_chunks_select_same_company on public.document_chunks;
create policy document_chunks_select_same_company on public.document_chunks for select to authenticated using(
 company_id=(select public.current_company_id()) and exists(select 1 from public.document_families f where f.company_id=public.current_company_id() and f.project_id=document_chunks.project_id and not f.archived and f.current_document_id=document_chunks.document_id)
);
create function public.search_document_families(p_project uuid default null,p_query text default '',p_archived boolean default false,p_offset integer default 0) returns setof public.document_families language sql stable security invoker set search_path='' as $$
 select f.* from public.document_families f where f.company_id=public.current_company_id() and (p_project is null or f.project_id=p_project) and f.archived=p_archived
 and (trim(p_query)='' or strpos(lower(f.title||' '||f.category||' '||f.collection||' '||f.trade),lower(left(trim(p_query),200)))>0
 or exists(select 1 from public.document_versions v join public.documents d on d.id=v.document_id where v.family_id=f.id and strpos(lower(d.filename||' '||v.issue_label||' '||coalesce(v.issued_on::text,'')),lower(left(trim(p_query),200)))>0))
 order by f.updated_at desc,f.id limit 51 offset least(greatest(p_offset,0),100000)
$$;
revoke all on function public.search_document_families(uuid,text,boolean,integer) from public,anon,service_role;
grant execute on function public.search_document_families(uuid,text,boolean,integer) to authenticated;
create view public.current_project_documents with (security_invoker=true) as select d.id,d.company_id,d.project_id,d.filename,d.storage_path,f.category as document_type,d.uploaded_by,d.created_at,d.content_type,d.byte_size,d.sha256,d.status from public.documents d join public.document_families f on f.current_document_id=d.id where not f.archived and d.status='ready';
revoke all on public.current_project_documents from public,anon,authenticated,service_role;
grant select on public.current_project_documents to authenticated;
notify pgrst,'reload schema';
commit;
