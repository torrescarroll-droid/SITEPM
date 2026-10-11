"""Local-only PG17 fixture using binaries in an existing SITEPM container.

Run: python3 supabase/operations/test-storage-pause-reversibility.py
Starts a private Unix-socket-only cluster without Supabase privilege overrides.
All roles/data are synthetic; existing databases and cluster roles are untouched.
No passwords, host ports, downloads or production connections. Stops the
temporary server afterwards; its private fixture directory remains for inspection.
"""
from pathlib import Path
import json
import subprocess
import uuid

container = "supabase_db_sitepm-isolated"
database = "sitepm_storage_pause_" + uuid.uuid4().hex
fixture = "/tmp/" + database
root = Path(__file__).resolve().parent


def sql(query, role="postgres", db=None):
    result = subprocess.run(
        ["docker", "exec", "-u", "postgres", "-i", container, "psql", "-X", "-v",
         "ON_ERROR_STOP=1", "-h", fixture, "-p", "55499", "-U", role,
         "-d", db or database, "-Atq"],
        input=query, text=True, capture_output=True, timeout=90,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip())  # Synthetic fixture only.
    return result.stdout.strip()


snapshot = """
SELECT jsonb_build_object(
 'rows',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM storage.objects o),
 'owner',(SELECT relowner FROM pg_class WHERE oid='storage.objects'::regclass),
 'acl',(SELECT relacl::text FROM pg_class WHERE oid='storage.objects'::regclass),
 'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p
   WHERE schemaname='storage'),
 'app_rows',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.projects p),
 'members',(SELECT md5(string_agg(to_jsonb(m)::text,'' ORDER BY roleid,member,grantor))
   FROM pg_auth_members m),
 'roles',(SELECT md5(string_agg(to_jsonb(r)::text,'' ORDER BY oid)) FROM pg_roles r)
);
"""

def command(*args):
    subprocess.run(["docker", "exec", "-u", "postgres", container, *args],
                   check=True, capture_output=True, text=True, timeout=60)


command("mkdir", "-m", "700", fixture)
command("initdb", "-D", fixture + "/data", "--username=fixture_bootstrap", "--auth=trust")
command("pg_ctl", "-D", fixture + "/data", "-l", fixture + "/server.log",
        "-o", "-c listen_addresses='' -c shared_preload_libraries='' -k " + fixture + " -p 55499",
        "-w", "start")
paused = False
try:
    assert sql("SELECT current_setting('server_version_num')::int / 10000;",
               "fixture_bootstrap", "postgres") == "17"
    sql("""
    CREATE ROLE postgres LOGIN CREATEDB CREATEROLE BYPASSRLS;
    CREATE ROLE supabase_storage_admin;
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE ROLE authenticator LOGIN;
    GRANT authenticator TO postgres WITH ADMIN TRUE, SET FALSE, INHERIT FALSE;
    GRANT authenticated TO postgres WITH SET TRUE, INHERIT FALSE;
    -- Model the existing managed operator's pre-request configuration ability.
    -- This fixture-only parameter grant confers no managed-table ownership.
    GRANT SET ON PARAMETER "pgrst.db_pre_request" TO postgres;
    """, "fixture_bootstrap", "postgres")
    sql(f'CREATE DATABASE "{database}" OWNER postgres;', "fixture_bootstrap", "postgres")
    sql("""
    CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;
    SET ROLE supabase_storage_admin;
    CREATE TABLE storage.objects(id integer PRIMARY KEY, tenant text, name text);
    INSERT INTO storage.objects VALUES(1,'A','photo.jpg'),(2,'B','private.pdf');
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY fixture_tenant ON storage.objects TO authenticated
      USING(tenant=current_setting('fixture.tenant',true))
      WITH CHECK(tenant=current_setting('fixture.tenant',true));
    GRANT USAGE ON SCHEMA storage TO postgres,authenticated;
    GRANT SELECT,TRIGGER ON storage.objects TO postgres;
    GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON storage.objects TO authenticated;
    RESET ROLE;
    """, "fixture_bootstrap")
    sql("CREATE TABLE public.projects(id integer PRIMARY KEY);"
        "INSERT INTO public.projects VALUES(1);"
        "GRANT SELECT,UPDATE ON public.projects TO authenticated;")
    assert sql("SELECT NOT rolsuper AND NOT pg_has_role(current_user,"
               "'supabase_storage_admin','USAGE') AND NOT pg_has_role(current_user,"
               "'supabase_storage_admin','SET') AND has_table_privilege(current_user,"
               "'storage.objects','TRIGGER') FROM pg_roles WHERE rolname=current_user;") == "t"
    before = json.loads(sql(snapshot))
    trigger_oid = None
    for cycle in range(2):
        sql((root / "pause-release-writes.sql").read_text())
        paused = True
        oid = sql("SELECT oid FROM pg_trigger WHERE tgrelid='storage.objects'::regclass "
                  "AND tgname='sitepm_release_write_pause';")
        if trigger_oid is not None:
            assert oid == trigger_oid, "Storage trigger was replaced"
        trigger_oid = oid
        sql((root / "refresh-release-write-guards.sql").read_text())
        sql("""
        DO $$ DECLARE command text; BEGIN
          BEGIN
            DROP TRIGGER sitepm_release_write_pause ON storage.objects;
            RAISE EXCEPTION 'Fixture operator unexpectedly owns Storage';
          EXCEPTION WHEN insufficient_privilege THEN NULL; END;
          SET LOCAL ROLE authenticated;
          PERFORM set_config('fixture.tenant','A',true);
          IF (SELECT count(*) FROM storage.objects)<>1 THEN
            RAISE EXCEPTION 'Tenant read isolation failed'; END IF;
          FOREACH command IN ARRAY ARRAY[
            'INSERT INTO storage.objects VALUES(3,''A'',''probe'')',
            'UPDATE storage.objects SET name=name WHERE false',
            'DELETE FROM storage.objects WHERE false',
            'TRUNCATE storage.objects',
            'UPDATE public.projects SET id=id WHERE false'] LOOP
            BEGIN
              EXECUTE command;
              RAISE EXCEPTION 'Pause bypass: %',command;
            EXCEPTION WHEN object_not_in_prerequisite_state THEN
              IF SQLERRM<>'SITEPM_RELEASE_PAUSED' THEN RAISE; END IF;
            END;
          END LOOP;
          BEGIN
            EXECUTE 'CREATE OR REPLACE FUNCTION sitepm_release.block_write() RETURNS trigger LANGUAGE plpgsql AS ''BEGIN RETURN NULL; END''';
            RAISE EXCEPTION 'Client changed pause function';
          EXCEPTION WHEN insufficient_privilege THEN NULL; END;
          PERFORM set_config('request.method','POST',true);
          BEGIN
            PERFORM sitepm_release.check_request();
            RAISE EXCEPTION 'REST guard failed';
          EXCEPTION WHEN SQLSTATE 'PT503' THEN NULL; END;
        END $$;
        """)
        sql((root / "resume-release-writes.sql").read_text())
        paused = False
        sql("""
        BEGIN;
        SET LOCAL ROLE authenticated;
        SET LOCAL fixture.tenant='A';
        INSERT INTO storage.objects VALUES(3,'A','rolled-back-probe');
        UPDATE storage.objects SET name='updated' WHERE id=3;
        DELETE FROM storage.objects WHERE id=3;
        DO $$ BEGIN
          IF (SELECT count(*) FROM storage.objects)<>1 THEN
            RAISE EXCEPTION 'Resume changed tenant visibility'; END IF;
          BEGIN
            INSERT INTO storage.objects VALUES(4,'B','forbidden');
            RAISE EXCEPTION 'Cross-tenant write accepted';
          EXCEPTION WHEN insufficient_privilege THEN NULL; END;
        END $$;
        TRUNCATE storage.objects;
        ROLLBACK;
        """)
        assert json.loads(sql(snapshot)) == before, "Rows, ACLs, RLS, ownership or roles changed"
        assert sql("SELECT count(*) FROM pg_trigger g JOIN pg_class c ON c.oid=g.tgrelid "
                   "JOIN pg_namespace n ON n.oid=c.relnamespace "
                   "WHERE tgname='sitepm_release_write_pause' AND nspname='public';") == "0"
        print(f"PASS cycle {cycle+1}: restricted pause, refresh, resume; Storage trigger reused; rows/ACL/RLS/owners/roles unchanged")
    print("PASS: no elevated memberships, ownership changes, production access or migrations")
finally:
    if paused:
        # Do not discard the database while its shared local role hook is active.
        sql((root / "resume-release-writes.sql").read_text())
    command("pg_ctl", "-D", fixture + "/data", "-m", "fast", "-w", "stop")
