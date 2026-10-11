# V3 verifier and V4 transition preparation

Base: `codex/release-sprints-3-6`, `c6f22d12d139e6e323ebee22151ab03f4c17fd9d`.
Development changes only; no production access, deployment, commit or push performed.
The five approved migrations and their manifest are unchanged. V2 is complete, not repeated.

## V3: prepared and capability-tested

`supabase/operations/prepare-document-verifier.sql` creates a separate
`sitepm_document_server` **NOLOGIN** role. It inherits only the existing
`sitepm_document_verifier` capability, with SET and ADMIN both false. It has no
superuser, database/role creation, replication or RLS bypass. The original
verifier capability role remains NOLOGIN. No passwords were generated or changed.

The recovery project `sdqnkvpparemaptbqnkj` is the sole database used. The role
was prepared there through the existing Supabase integration. A rollback-only
acceptance script verifies:

- No public/Auth/Storage table access and no client verifier membership.
- Authenticated document registration cannot attest its own bytes.
- Wrong hash rejected; trusted verification succeeds; exact retry gives one event.
- Other-company verification rejected; processing begin/result work.
- All synthetic documents, versions, attempts and events roll back.

PostgreSQL 17 role creators do not automatically receive SET permission. The
test grants **postgres only** temporary SET on the server role inside its rolled-back
transaction. This neither grants API users a capability nor changes persistent
membership. Actual password authentication is **not** claimed: the server role
is intentionally NOLOGIN until an authorized release provisions its new secret.

### Exact Railway configuration

Keep existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY` and
`SITEPM_EXTRACTOR_DATABASE_URL` unchanged.

Set server-only `SITEPM_DOCUMENT_DATABASE_URL` to a PostgreSQL connection for
**sitepm_document_server**, database `postgres`, port **5432**, targeting the
production reference **dsibhbqfklpharqujnbc** at release time. Direct template:

```text
postgresql://sitepm_document_server:<URL-encoded-new-password>@db.dsibhbqfklpharqujnbc.supabase.co:5432/postgres
```

If Railway requires the Session pooler, copy its exact hostname from that
project's Connect panel, use port 5432 and username
`sitepm_document_server.dsibhbqfklpharqujnbc`. Do not guess a regional hostname.
Verify connectivity from the deployment environment before reopening uploads.
Never use postgres, service_role, the extractor login or a recovery credential
as the verifier connection.

Set `SITEPM_DATABASE_CA_CERT` to the provider CA certificate's **PEM contents**
if the endpoint is not trusted by Node's default roots. This is not a filename.
The shared TLS helper always enforces certificate chain and original hostname
verification remotely, irrespective of URL SSL options. Do not set
`NODE_TLS_REJECT_UNAUTHORIZED=0`. No `NEXT_PUBLIC_` credential variables.

At authorized production release only, run the prepared NOLOGIN provisioning
operation after migration 5, set the **new server login's** password using a
secure hidden local PostgreSQL client prompt (`\password sitepm_document_server`),
then explicitly enable LOGIN. This is new restricted access, not rotation of
existing credentials. Do not use the local fixture provisioning script in production.

## V4: database-backed pause

No application-only flag or banner can block older clients calling Supabase
directly. The prepared operator SQL uses existing PostgreSQL/PostgREST facilities:

1. A SECURITY INVOKER pre-request hook rejects non-read Data API methods with
   `PT503` / `SITEPM_RELEASE_PAUSED`. Unknown/missing methods fail closed. GET,
   HEAD and OPTIONS preserve normal authorization. Read-only POST RPCs are also
   paused during the short window.
2. BEFORE STATEMENT triggers reject INSERT/UPDATE/DELETE/TRUNCATE on all existing
   public tables and `storage.objects`, including zero-row statements. This
   covers old direct writers, bounded writer RPCs, restricted direct server
   connections, and Storage metadata writes. Existing RLS/grants are not replaced.
3. Only an unattributed postgres administrator session can perform migration
   backfills. Both session identity and effective identity are checked, so a
   postgres-owned extraction function does not confer a nonadministrator session
   a maintenance bypass. JWT-attributed administrator test calls are blocked too.
4. Refresh guards after each migration to include its new tables. The Data API
   hook covers new RPCs/tables during that interval. Do not provision new direct
   logins until the refresh has completed.

Installation takes table locks (bounded at 5s), draining existing table writers.
Stop on any timeout/error; do not retry automatically. Capture the release data
baseline only **after the pause is verified**, to account for saves completed
before the locks were acquired.

Storage metadata cannot commit while paused. An in-flight Storage service may
have transferred bytes before database rejection; this is not a confirmed
document. Retain pending upload identities and reconcile/retry after release;
do not delete originals or claim the pause stops every network byte transfer.

The pause is intentionally company-wide and affects all application table writes
and Storage metadata, including unrelated edits briefly. Reads retain original
RLS. No Auth schema triggers are added; signup can fail atomically when its
public profile/company creation is blocked. Ordinary existing-user authentication
is not deliberately disabled.

### Safe release/resume sequence

1. Under explicit production execution authorization, run
   `pause-release-writes.sql`; it refuses an existing nonempty pre-request hook.
   Verify a real production API write-shaped probe receives `PT503` and verify
   trigger coverage. Drain uploads and capture baseline. No migrations until this passes.
2. Apply only the five manifest migrations, in manifest order, with their existing
   transaction/timeouts. After each success run `refresh-release-write-guards.sql`.
   Keep the pause continuous; stop on the first failure without undoing committed migrations.
3. Provision the restricted verifier login/configuration as above. Check all
   approved integrity/security postflight results. The existing GitHub-to-Railway
   workflow remains the deployment route; it was not reinvestigated.
4. Deploy the matching reviewed candidate. While paused, check login, project
   reads, new screens, effective verifier ACLs and certificate-verified server
   authentication. A premature write must produce the pause message, never success.
5. Once the matching deployment is healthy and old deployment instances are drained, run `resume-release-writes.sql`.
   It removes only its own triggers and restores the previous authenticator hook
   setting (including absent vs explicitly empty), without changing original ACLs/RLS.
   Its harmless no-op hook remains available during configuration reload overlap,
   preventing missing-function errors on pooled requests. This allows later pauses.
6. Verify resume through actual API requests and safe rolled-back database probes;
   reconcile pending uploads and tell users to retry the same saved submission.
   If rollout fails, keep/re-establish the pause and forward-fix. Do not reopen
   old scheduling/document writers, weaken grants, or roll back schema destructively.

Report/schedule/document server actions now translate the exact pause code/message
into a clear retained-draft/retry response. They do not report success or uncertain
persistence for a rejected write. Existing confirmed-success recovery remains valid.

## Evidence and remaining limit

Recovery SQL acceptance passed for legacy direct writes, bounded roles, actual
report/resource/document/processing RPCs, Storage metadata, all modifying HTTP
method checks inside the pre-request function, reads, administrator backfills,
new-table guard refresh and resume. Verifier acceptance passed again after resume.
Original RLS policy fingerprint and documents/projects/reports/activities full-row
fingerprints matched before and after. All **23 documents**, including **15 Markdown**
documents, remain. Recovery has no pause triggers and its authenticator setting is
restored. Only the prepared NOLOGIN server role and harmless no-op hook remain.

**Actual HTTP gateway acceptance is pending.** The Supabase connector's returned
recovery anon key has the correct reference/anon claim but the recovery gateway
rejects it with `401 Invalid API key` before PostgREST. No credentials were rotated,
no production key substituted and no claim of a gateway test pass is made.
The HTTP script is recovery-only, prints only sanitized status/errors, uses an
empty insert array and impossible-ID update/delete probes, and never returns data.
Do not lift the production release pause on SQL-only evidence; verify the actual
gateway block before migration and the actual gateway resume after deployment.

The single operator input needed to finish this test is the recovery dashboard's
current **publishable/anon** key, entered with the offline hidden prompt script.
It rejects privileged/service keys and stores only the public client key in a
0600 temporary file outside Git. No database password is requested.

Tests: document suites; field reliability; scheduling; operations; TLS real
synthetic handshake/hostname/CA tests; TypeScript after route type generation;
lint (one existing unused-tokenize warning). Production webpack build passed with network access for the existing Google Fonts
dependency and nonsecret loopback-only Supabase build placeholders. Initial
sandbox font DNS failure and the fresh worktree's missing build environment were
resolved without changing application configuration or using production credentials. No physical-device or new browser acceptance is claimed.

### Recovery HTTP input retry — 2026-10-10

The operator-supplied public API input also returned HTTP 401 Invalid API key
on the initial read-only gateway probe, using only the apikey header (compatible
with publishable keys). The test stopped before any pause installation or write
probe. Managed read-only inspection confirmed zero pause triggers, 23 documents
and 15 legacy Markdown records. The rejected temporary public-key input was
removed so hidden entry can be repeated. No credentials were rotated, no
production access occurred, and actual gateway acceptance remains blocked.

### Recovery HTTP pause/resume acceptance — PASS, 2026-10-10

The replacement publishable key was accepted. The gateway OpenAPI root
requires a secret key; no elevated key was requested or used. Anonymous project
reads and current_company_id calls are intentionally denied by existing grants.
The HTTP test therefore uses the read-only company-context endpoint and accepts
only normal permission denial or a successful read, never a pause on GET.

Before pause: GET RPC and POST/PATCH/DELETE project probes and POST RPC all
returned HTTP 401 / PostgreSQL 42501, matching the original anonymous privileges.
During pause: all four write-shaped probes returned HTTP 503 / PT503 /
SITEPM_RELEASE_PAUSED; GET retained its original 42501 denial. After resume:
all five statuses/codes/messages matched the baseline. Empty-array inserts and
impossible-ID updates/deletes cannot change business records. Native HTTPS
certificate verification remained enabled.

The rolled-back SQL pause acceptance passed again, including authenticated and
bounded writer roles, real transactional save calls, Storage metadata and
new-table guard refresh. Final checks found zero pause triggers, the original
authenticator hook restored, and the server role still NOLOGIN without superuser
or RLS bypass. Full-row fingerprints for documents, projects, reports and
activities, plus RLS policy fingerprints, matched exactly before/after.
All 23 documents and 15 legacy Markdown records remain unchanged.

Scope limit: real HTTP acceptance used the anonymous publishable-key role; it
does not establish authenticated-user browser save acceptance or password-based
verifier login. Authenticated/bounded role pause behavior was tested through SQL.
Verifier login activation and certificate-verified password authentication remain
part of explicitly authorized release provisioning. No production access, commit,
push, migration or deployment occurred in this acceptance session.
