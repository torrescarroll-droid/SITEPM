-- Recovery ONLY; synthetic documents rollback. No existing business row updated.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
-- PostgreSQL 17 creator ADMIN does not imply SET. This test-only administrator
-- assumption is rolled back; no application/client receives membership.
GRANT sitepm_document_server TO postgres WITH SET TRUE;
DO $$ DECLARE actor uuid;other_actor uuid;job uuid;company uuid;
 d uuid=gen_random_uuid();request uuid=gen_random_uuid();r jsonb; BEGIN
 SELECT p.auth_user_id,j.id,j.company_id INTO STRICT actor,job,company
 FROM public.projects j JOIN public.profiles p ON p.company_id=j.company_id
 WHERE p.auth_user_id IS NOT NULL LIMIT 1;
 SELECT auth_user_id INTO STRICT other_actor FROM public.profiles
 WHERE company_id<>company AND auth_user_id IS NOT NULL LIMIT 1;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','storage','auth') AND c.relkind IN ('r','p','v')
   AND (has_table_privilege('sitepm_document_server',c.oid,'INSERT')
    OR has_table_privilege('sitepm_document_server',c.oid,'UPDATE')
    OR has_table_privilege('sitepm_document_server',c.oid,'DELETE')
    OR has_table_privilege('sitepm_document_server',c.oid,'SELECT'))) THEN
  RAISE EXCEPTION 'Verifier must have no application/Auth/Storage table access';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sitepm_document_server'
  AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN
  RAISE EXCEPTION 'Unsafe server preparation attributes';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
  WHERE m.roleid='sitepm_document_verifier'::regrole
   AND (r.rolname NOT IN ('postgres','sitepm_document_server')
    OR (r.rolname='sitepm_document_server' AND (m.admin_option OR m.set_option OR NOT m.inherit_option)))) THEN
  RAISE EXCEPTION 'Unexpected verifier membership';
 END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 r=public.begin_document_upload(request,jsonb_build_object('id',d,'project_id',job,
  'title','V3 rolled-back verifier acceptance','filename','v3-acceptance.pdf',
  'category','other','content_type','application/pdf','byte_size',8,
  'sha256',repeat('a',64),'storage_path',company||'/'||job||'/'||d||'/v3-acceptance.pdf'));
 BEGIN
  PERFORM public.verify_document_upload(request,repeat('a',64),8);
  RAISE EXCEPTION 'Authenticated attestation unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 SET LOCAL ROLE sitepm_document_server;
 BEGIN
  PERFORM public.verify_document_upload(request,repeat('b',64),8);
  RAISE EXCEPTION 'Incorrect hash unexpectedly accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Stored file identity mismatch' THEN RAISE; END IF;
 END;
 r=public.verify_document_upload(request,repeat('a',64),8);
 IF r->>'verified'<>'true' THEN RAISE EXCEPTION 'Verification failed';END IF;
 IF r IS DISTINCT FROM public.verify_document_upload(request,repeat('a',64),8) THEN
  RAISE EXCEPTION 'Retry changed result';END IF;
 PERFORM set_config('request.jwt.claim.sub',other_actor::text,true);
 BEGIN
  PERFORM public.verify_document_upload(request,repeat('a',64),8);
  RAISE EXCEPTION 'Foreign-company verification unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE sitepm_document_server;
 PERFORM public.request_document_processing(d);
 PERFORM public.document_processing_result(d,'retry_required');
 BEGIN
  PERFORM * FROM public.documents LIMIT 1;
  RAISE EXCEPTION 'Verifier table read unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RESET ROLE;
 IF (SELECT count(*) FROM public.document_events WHERE document_id=d AND kind='upload_verified')<>1 THEN
  RAISE EXCEPTION 'Retry duplicated verification event';END IF;
END $$;
SELECT 'PASS: restricted server capability, no table access, hash rejection, trusted verification/retry, processing and Company A/B isolation; synthetic rows rolled back' AS result;
ROLLBACK;
