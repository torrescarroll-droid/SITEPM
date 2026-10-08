/** Read-only acceptance against a local SITEPM server and existing A/B test accounts.
 * Creates/revokes auth sessions only; never writes business records or storage objects.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createServerClient } from "@supabase/ssr";
const env = { ...parseEnv(readFileSync(".env.local", "utf8")), ...process.env };
const base = new URL(env.SITEPM_VERIFY_BASE || "http://127.0.0.1:3107");
assert(["localhost", "127.0.0.1"].includes(base.hostname), "Acceptance runs only against a local server");
const clients = [];
try {
  const accounts = [];
  for (const label of ["A", "B"]) {
    const cookies = new Map();
    const client = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (items) => items.forEach(({ name, value }) => cookies.set(name, value)),
      },
      global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) }) },
    });
    clients.push(client);
    const signed = await client.auth.signInWithPassword({ email: env[`SITEPM_ISO_${label}_EMAIL`], password: env[`SITEPM_ISO_${label}_PASSWORD`] });
    assert(!signed.error && signed.data.user, `${label}: authentication must succeed`);
    const profile = await client.from("profiles").select("company_id").eq("auth_user_id", signed.data.user.id).single();
    assert(!profile.error && profile.data?.company_id, `${label}: profile must resolve`);
    accounts.push({ client, cookies, companyId: profile.data.company_id });
  }
  const [a, b] = accounts;
  assert.notEqual(a.companyId, b.companyId);
  const found = await a.client.from("field_logs").select("id,project_id").eq("company_id", a.companyId).limit(1).single();
  assert(!found.error && found.data, "Company A needs an existing report for read-only acceptance");
  const { id: reportId, project_id: projectId } = found.data;
  const get = async (account, path) => {
    const response = await fetch(new URL(path, base), {
      headers: { Cookie: [...account.cookies].map(([key, value]) => `${key}=${value}`).join("; ") },
      redirect: "manual", signal: AbortSignal.timeout(60000),
    });
    return { status: response.status, body: await response.text() };
  };
  for (const path of [`/projects/${projectId}/lookahead`, `/projects/${projectId}/field/${reportId}`]) {
    const own = await get(a, path);
    assert.equal(own.status, 200, "Company A page should render");
    assert(own.body.includes(path.endsWith("lookahead") ? "Report follow-through" : "Follow-up accountability"), "Expected workflow must render");
    const denied = await get(b, path);
    // Next's loading boundary streams a 200 before notFound() resolves. Assert the
    // documented refusal markup and absence of protected content, not only status.
    assert([200, 404].includes(denied.status));
    assert(denied.body.includes('name="robots" content="noindex"') && denied.body.includes("NEXT_HTTP_ERROR_FALLBACK;404"), "Company B must receive not-found refusal");
    assert(!denied.body.includes("Report follow-through") && !denied.body.includes("Follow-up accountability"), "Protected workflow must not render for Company B");
    console.log(`PASS authenticated ${path.endsWith("lookahead") ? "lookahead" : "source report"}: A renders; B gets not-found refusal without protected content`);
  }
  const malformed = await get(a, `/projects/${projectId}/field/not-a-report`);
  assert([200, 404].includes(malformed.status));
  assert(malformed.body.includes("NEXT_HTTP_ERROR_FALLBACK;404"));
  assert(!malformed.body.includes("Follow-up accountability"));
  console.log("PASS malformed report URL receives not-found refusal");
  const home = await get(a, "/");
  assert.equal(home.status, 200);
  assert(home.body.includes("Open two-week lookahead"));
  console.log("PASS authenticated home connects active jobs to lookahead");
  const publicResult = await fetch(new URL(`/projects/${projectId}/lookahead`, base), { redirect: "manual", signal: AbortSignal.timeout(60000) });
  assert([302, 303, 307, 308].includes(publicResult.status));
  assert(publicResult.headers.get("location")?.includes("/login"));
  console.log("PASS signed-out lookahead redirects to login");
  console.log("Read-only local route acceptance passed; no business records modified");
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : "Read-only route acceptance failed; check local runtime and authentication.");
  process.exitCode = 1;
} finally {
  for (const client of clients) await client.auth.signOut({ scope: "local" });
}
