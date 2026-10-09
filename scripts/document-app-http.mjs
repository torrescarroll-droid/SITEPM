/** HTTP integration against the built LOCAL app. Not a browser interaction test. */
import { isolatedEnvironment } from "./isolated-environment.mjs";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import assert from "node:assert/strict";
const e = isolatedEnvironment(),
  f = parseEnv(readFileSync(".env.document-browser.local", "utf8")),
  base = `http://127.0.0.1:${e.APP_PORT ?? 3108}`;
assert.equal(new URL(base).port, "3108");
async function actor(email) {
  let jar = [];
  const client = createServerClient(e.API_URL, e.ANON_KEY, {
    cookies: {
      getAll: () => jar,
      setAll: (x) => {
        jar = x.map(({ name, value }) => ({ name, value }));
      },
    },
  });
  assert.ifError(
    (await client.auth.signInWithPassword({ email, password: f.PASSWORD }))
      .error,
  );
  return {
    client,
    cookie: () => jar.map((x) => `${x.name}=${x.value}`).join("; "),
  };
}
async function page(a, path, status = 200, text) {
  const r = await fetch(base + path, {
    headers: { Cookie: a.cookie() },
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  const html = await r.text();
  if (status === 404 && r.status === 200) {
    assert(
      html.includes("NEXT_HTTP_ERROR_FALLBACK;404"),
      path + " streamed not-found marker",
    );
    assert(
      !html.includes("Version history"),
      path + " must not disclose document detail",
    );
  } else assert.equal(r.status, status, path);
  if (text) assert(html.includes(text), path + " expected content");
  assert(
    !html.includes("NEXT_HTTP_ERROR_FALLBACK;500"),
    path + " server error",
  );
  return r;
}
const a = await actor(f.EMAIL_A),
  b = await actor(f.EMAIL_B);
await page(a, "/documents", 200, "Document desk");
await page(a, `/documents/${f.FAMILY_A}`, 200, "Version history");
await page(a, `/projects/${f.PROJECT_A}`, 200);
for (const p of ["documents", "tasks", "schedule"])
  await page(a, `/projects/${f.PROJECT_A}/${p}`, 200);
await page(b, `/documents/${f.FAMILY_A}`, 404);
await page(b, `/documents/file/${f.DOCUMENT_A}`, 404);
console.log(
  "PASS built application authenticated document/detail/project/task/schedule rendering; Company B detail/file denial",
);
