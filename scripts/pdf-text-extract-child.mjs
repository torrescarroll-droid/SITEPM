import { createJiti } from "jiti";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, {
  alias: { "@": root },
});

const {
  PdfTextExtractError,
  extractPdfTextLayer,
} = await jiti.import("../lib/pdf-text-extract.ts");

const raw = process.env.SITEPM_PDF_EXTRACT_OPTIONS ?? "{}";
let options = {};
try {
  options = JSON.parse(raw);
} catch {
  process.stderr.write("invalid SITEPM_PDF_EXTRACT_OPTIONS\n");
  process.exit(1);
}

const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
const bytes = Buffer.concat(chunks);

try {
  const result = await extractPdfTextLayer(bytes, options);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  if (error instanceof PdfTextExtractError) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        code: error.code,
        message: error.message,
        quality: error.quality,
      }),
    );
    process.exit(0);
  }
  process.stderr.write(
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exit(1);
}
