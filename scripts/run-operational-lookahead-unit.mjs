import { createJiti } from "jiti";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": root }, fsCache: false });
await jiti.import("./operational-lookahead-unit.ts");
await import("./operational-actions-unit.mjs");
