-- Run after EACH approved migration, before provisioning any direct login.
-- The pre-request hook protects newly introduced Data API mutations meanwhile.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT sitepm_release.refresh_write_guards();
COMMIT;
