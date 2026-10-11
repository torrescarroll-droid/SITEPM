-- Run ONLY after the matching deployment and paused checks pass. No CASCADE.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ DECLARE t record;previous text; BEGIN
 IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
  RAISE EXCEPTION 'Administrator required';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles r,unnest(r.rolconfig) c
  WHERE r.rolname='authenticator' AND c='pgrst.db_pre_request=sitepm_release.check_request') THEN
  RAISE EXCEPTION 'Unexpected pre-request configuration; pause retained';
 END IF;
 FOR t IN SELECT n.nspname,c.relname FROM pg_trigger g JOIN pg_class c ON c.oid=g.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE g.tgname='sitepm_release_write_pause'
   AND g.tgfoid='sitepm_release.block_write()'::regprocedure
  ORDER BY n.nspname,c.relname
 LOOP
  EXECUTE format('DROP TRIGGER sitepm_release_write_pause ON %I.%I',t.nspname,t.relname);
 END LOOP;
 IF EXISTS (SELECT 1 FROM sitepm_release.previous_hook) THEN
  SELECT value INTO STRICT previous FROM sitepm_release.previous_hook;
  EXECUTE format('ALTER ROLE authenticator SET pgrst.db_pre_request=%L',previous);
 ELSE
  ALTER ROLE authenticator RESET pgrst.db_pre_request;
 END IF;
END $$;
-- Leave the harmless read-only hook function until reload propagates; old pooled
-- requests must not fail because their configured function was dropped early.
CREATE OR REPLACE FUNCTION sitepm_release.check_request() RETURNS void
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN RETURN; END $$;
DROP FUNCTION sitepm_release.refresh_write_guards();
DROP FUNCTION sitepm_release.block_write();
DROP TABLE sitepm_release.previous_hook;
NOTIFY pgrst, 'reload config';
COMMIT;
-- sitepm_release + its no-op hook intentionally remain for safe reload overlap.
