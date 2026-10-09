/** Complete local-only database/Storage regression. Never accepts a hosted endpoint. */
import { isolatedEnvironment } from "./isolated-environment.mjs";
import { spawn } from "node:child_process";
isolatedEnvironment();
for (const script of [
  "verify-document-legacy.mjs",
  "document-management-db.mjs",
  "document-search-db.mjs",
  "document-tus-db.mjs",
  "document-limits-db.mjs",
  "field-reliability-db.mjs",
  "construction-scheduling-db.mjs",
  "construction-scheduling-review.mjs",
]) {
  console.log("RUN " + script);
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/" + script], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", resolve);
    child.on("error", () => resolve(1));
  });
  if (code !== 0) process.exit(code ?? 1);
}
console.log(
  "PASS all isolated document, Storage, Sprint 3 and Sprint 4 acceptance suites",
);
