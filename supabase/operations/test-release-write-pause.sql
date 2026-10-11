-- Run with pause INSTALLED in recovery; no matching rows are modified.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
GRANT sitepm_document_server TO postgres WITH SET TRUE;
DO $$ DECLARE role_name text;statement text;method text;actor uuid;job uuid;company uuid;d uuid; BEGIN
 FOR role_name IN SELECT unnest(ARRAY['authenticated','anon','service_role',
  'sitepm_field_writer','sitepm_schedule_writer','sitepm_document_writer','sitepm_document_server']) LOOP
  EXECUTE format('SET LOCAL ROLE %I',role_name);
  -- Invoke guard directly only via real triggers; clients cannot call it as RPC.
  FOR statement IN SELECT unnest(ARRAY[
   'UPDATE public.field_logs SET notes=notes WHERE false',
   'DELETE FROM public.field_log_crews WHERE false',
   'UPDATE public.schedule_activities SET name=name WHERE false',
   'UPDATE public.schedule_resources SET name=name WHERE false',
   'DELETE FROM public.schedule_assignments WHERE false',
   'DELETE FROM public.schedule_dependencies WHERE false',
   'UPDATE public.documents SET status=status WHERE false',
   'UPDATE public.document_versions SET processing_state=processing_state WHERE false',
   'UPDATE storage.objects SET name=name WHERE false']) LOOP
   BEGIN
    EXECUTE statement;
    RAISE EXCEPTION 'Pause failed for %: %',role_name,statement;
   EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM<>'SITEPM_RELEASE_PAUSED' THEN RAISE; END IF;
   WHEN insufficient_privilege THEN NULL; -- Existing grants still deny this path.
   END;
  END LOOP;
  RESET ROLE;
 END LOOP;
 SET LOCAL ROLE authenticated;
 FOR method IN SELECT unnest(ARRAY['POST','PUT','PATCH','DELETE','']) LOOP
  PERFORM set_config('request.method',method,true);
  BEGIN
   PERFORM sitepm_release.check_request();
   RAISE EXCEPTION 'Pre-request pause failed for %',method;
  EXCEPTION WHEN SQLSTATE 'PT503' THEN NULL;END;
 END LOOP;
 FOR method IN SELECT unnest(ARRAY['GET','HEAD','OPTIONS']) LOOP
  PERFORM set_config('request.method',method,true);
  PERFORM sitepm_release.check_request();
 END LOOP;
 -- Reads still execute through the original RLS (no identity sees no rows).
 PERFORM * FROM public.projects LIMIT 1;
 RESET ROLE;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE ((n.nspname='public' AND c.relkind IN ('r','p')) OR (n.nspname='storage' AND c.relname='objects'))
  AND NOT EXISTS(SELECT 1 FROM pg_trigger g WHERE g.tgrelid=c.oid
   AND g.tgname='sitepm_release_write_pause' AND g.tgenabled='O')) THEN
  RAISE EXCEPTION 'A table is missing its write guard';END IF;
 SELECT p.auth_user_id,j.id,j.company_id INTO STRICT actor,job,company
 FROM public.projects j JOIN public.profiles p ON p.company_id=j.company_id
 WHERE p.auth_user_id IS NOT NULL LIMIT 1;
 d=gen_random_uuid();
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 BEGIN
  PERFORM public.save_field_report(gen_random_uuid(),job,null,null,
   '{"log_date":"2026-10-10","work_performed":"Rolled-back pause probe","issue_flag":false}'::jsonb,'[]'::jsonb,null);
  RAISE EXCEPTION 'Report RPC bypassed pause';
 EXCEPTION WHEN object_not_in_prerequisite_state THEN
  IF SQLERRM<>'SITEPM_RELEASE_PAUSED' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.save_construction_schedule(gen_random_uuid(),'resource',
   jsonb_build_object('id',gen_random_uuid(),'name','Pause probe','resource_type','crew','active',true));
  RAISE EXCEPTION 'Schedule RPC bypassed pause';
 EXCEPTION WHEN object_not_in_prerequisite_state THEN
  IF SQLERRM<>'SITEPM_RELEASE_PAUSED' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.begin_document_upload(gen_random_uuid(),jsonb_build_object('id',d,'project_id',job,
   'title','Pause probe','filename','pause.pdf','category','other','content_type','application/pdf',
   'byte_size',8,'sha256',repeat('a',64),'storage_path',company||'/'||job||'/'||d||'/pause.pdf'));
  RAISE EXCEPTION 'Document registration bypassed pause';
 EXCEPTION WHEN object_not_in_prerequisite_state THEN
  IF SQLERRM<>'SITEPM_RELEASE_PAUSED' THEN RAISE;END IF;END;
 RESET ROLE;
 SET LOCAL ROLE sitepm_document_server;
 BEGIN
  PERFORM public.document_processing_result(d,'retry_required');
  RAISE EXCEPTION 'Trusted processing RPC bypassed pause';
 EXCEPTION WHEN object_not_in_prerequisite_state THEN
  IF SQLERRM<>'SITEPM_RELEASE_PAUSED' THEN RAISE;END IF;
 END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub','',true);
 -- The administrator can run migration/backfill statements; no rows changed.
 UPDATE public.documents SET status=status WHERE false;
END $$;
-- A table added by a migration is covered by the same refresh operation.
CREATE TABLE public.sitepm_release_probe(id integer);
GRANT INSERT ON public.sitepm_release_probe TO authenticated;
SELECT sitepm_release.refresh_write_guards();
DO $$ BEGIN
 SET LOCAL ROLE authenticated;
 BEGIN
  INSERT INTO public.sitepm_release_probe VALUES(1);
  RAISE EXCEPTION 'New-table refresh failed';
 EXCEPTION WHEN object_not_in_prerequisite_state THEN
  IF SQLERRM<>'SITEPM_RELEASE_PAUSED' THEN RAISE;END IF;
 END;
 RESET ROLE;
END $$;
SELECT 'PASS: old direct writers, bounded writers, Storage metadata, REST/RPC methods blocked; reads/RLS preserved; complete trigger coverage' AS result;
ROLLBACK;
