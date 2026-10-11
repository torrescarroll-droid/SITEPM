/** A new isolated stack only. Does not start, reset, delete or connect to any database. */
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { resolve, join, basename } from "node:path";
const root = resolve(process.argv[2] ?? "/private/tmp/sitepm-documents-replay");
assert(
  root.startsWith("/private/tmp/") && !existsSync(root),
  "Choose a new /private/tmp directory; existing stacks are preserved",
);
mkdirSync(join(root, "supabase", "migrations"), { recursive: true });
let config = readFileSync("supabase/config.toml", "utf8")
  .replaceAll("sitepm-isolated", basename(root))
  .replaceAll("3107", "3108");
for (const [a, b] of [
  ["55430", "55460"],
  ["55431", "55461"],
  ["55432", "55462"],
  ["55433", "55463"],
  ["55434", "55464"],
  ["55439", "55469"],
])
  config = config.replaceAll(a, b);
config = config.replace("sign_in_sign_ups = 30", "sign_in_sign_ups = 1000");
writeFileSync(join(root, "supabase", "config.toml"), config);
for (const name of [
  "19700101000000_local_baseline.sql",
  "20261008054310_field_report_atomic_save.sql",
]) {
  assert(
    existsSync("supabase/migrations/" + name),
    "Run db:isolated:prepare first",
  );
  copyFileSync(
    "supabase/migrations/" + name,
    join(root, "supabase", "migrations", name),
  );
}
console.log(
  "Prepared new local replay workspace; initialize managed Auth/Storage before applying scheduling/document migrations.",
);
