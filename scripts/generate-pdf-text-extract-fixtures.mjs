import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, {
  alias: { "@": root },
});

const fixtures = await jiti.import("./pdf-text-extract-fixtures.ts");
const dir = join(root, "tests/fixtures/pdf-text-extract");
mkdirSync(dir, { recursive: true });

const files = {
  "normal-multi-page.pdf": fixtures.normalMultiPagePdf(),
  "image-only.pdf": fixtures.buildImageOnlyPdf(),
  "malformed.pdf": fixtures.buildMalformedPdf(),
  "encrypted.pdf": fixtures.buildEncryptedPdf(),
  "sparse-text.pdf": fixtures.sparseTextPdf(),
  "prompt-injection.pdf": fixtures.promptInjectionPdf(),
  "4fd-e2e-zxq719.pdf": fixtures.stage4fDDistinctivePdf(),
  "4fd-prompt-zxq719.pdf": fixtures.stage4fDPromptLikePdf(),
};

for (const [name, bytes] of Object.entries(files)) {
  writeFileSync(join(dir, name), bytes);
  console.log(`wrote ${name} (${bytes.length} bytes)`);
}
