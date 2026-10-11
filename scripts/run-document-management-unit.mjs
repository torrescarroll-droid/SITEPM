import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);
await jiti.import("./document-management-unit.ts");

await jiti.import('./document-transport-unit.ts');
