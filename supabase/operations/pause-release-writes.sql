-- Operator operation, NOT a release migration. Verify target externally first.
-- Blocks old clients, new RPCs, Storage metadata and restricted direct writers.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
 IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
  RAISE EXCEPTION 'Release operations require the verified administrator session';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles r, unnest(r.rolconfig) c
   WHERE r.rolname='authenticator' AND c LIKE 'pgrst.db_pre_request=%'
   AND c <> 'pgrst.db_pre_request=') THEN
  RAISE EXCEPTION 'Existing pre-request hook requires review; nothing changed';
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS sitepm_release AUTHORIZATION postgres;
DO $$ BEGIN
 IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='sitepm_release')<>'postgres' THEN
  RAISE EXCEPTION 'Unexpected release schema owner';
 END IF;
END $$;
REVOKE ALL ON SCHEMA sitepm_release FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA sitepm_release TO anon,authenticated,service_role;
CREATE TABLE sitepm_release.previous_hook AS
 SELECT substring(c FROM length('pgrst.db_pre_request=')+1) AS value
 FROM pg_roles r, unnest(r.rolconfig) c
 WHERE r.rolname='authenticator' AND c LIKE 'pgrst.db_pre_request=%';
REVOKE ALL ON sitepm_release.previous_hook FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION sitepm_release.check_request() RETURNS void
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF coalesce(current_setting('request.method',true),'') NOT IN ('GET','HEAD','OPTIONS') THEN
  RAISE SQLSTATE 'PT503' USING MESSAGE='SITEPM_RELEASE_PAUSED',
   DETAIL='Writes are briefly paused for a release. Keep your draft and retry the same submission later.';
 END IF;
END $$;
REVOKE ALL ON FUNCTION sitepm_release.check_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sitepm_release.check_request() TO anon,authenticated,service_role;

CREATE FUNCTION sitepm_release.block_write() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 -- session_user prevents a postgres-owned extraction RPC bypassing the pause.
 -- JWT checks also make administrator-driven SET ROLE acceptance faithful.
 IF session_user='postgres' AND current_user='postgres'
  AND nullif(current_setting('request.jwt.claim.sub',true),'') IS NULL
  AND nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub' IS NULL THEN
  RETURN NULL;
 END IF;
 RAISE SQLSTATE '55000' USING MESSAGE='SITEPM_RELEASE_PAUSED',
  DETAIL='Writes are briefly paused for a release. Keep your draft and retry the same submission later.';
END $$;
REVOKE ALL ON FUNCTION sitepm_release.block_write() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION sitepm_release.refresh_write_guards() RETURNS void
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ DECLARE t record; BEGIN
 IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
  RAISE EXCEPTION 'Administrator required';
 END IF;
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE (n.nspname='public' AND c.relkind IN ('r','p'))
   OR (n.nspname='storage' AND c.relname='objects' AND c.relkind='r')
  ORDER BY n.nspname,c.relname
 LOOP
  EXECUTE format('CREATE OR REPLACE TRIGGER sitepm_release_write_pause BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION sitepm_release.block_write()',t.nspname,t.relname);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION sitepm_release.refresh_write_guards() FROM PUBLIC,anon,authenticated,service_role;
SELECT sitepm_release.refresh_write_guards();
ALTER ROLE authenticator SET pgrst.db_pre_request='sitepm_release.check_request';
NOTIFY pgrst, 'reload config';
COMMIT;
