-- Recovery preparation / reviewed production operation after migration 5.
-- No password is embedded, generated, returned or rotated by this script.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
 IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
  RAISE EXCEPTION 'Verified administrator session required';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sitepm_document_verifier'
  AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole) THEN
  RAISE EXCEPTION 'Approved verifier role missing or unsafe';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sitepm_document_server') THEN
  RAISE EXCEPTION 'Existing server role requires review; no credentials changed';
 END IF;
END $$;
CREATE ROLE sitepm_document_server NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT sitepm_document_verifier TO sitepm_document_server WITH INHERIT TRUE, SET FALSE, ADMIN FALSE;
COMMIT;
-- At authorized release ONLY: set a new password through a hidden local prompt,
-- then enable LOGIN. Keep the verifier capability role itself NOLOGIN.
