/**
 * Reference Project 001 source corpus loader.
 * Only `sources/*.md` is eligible. Evaluator files are never evidence.
 */

import { readFileSync, readdirSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import {
  extractMarkdownDocument,
  type DerivedExtractionDraft,
  type ReadyDocumentIdentity,
} from "@/lib/document-extract";

export const RP001_ROOT = "docs/reference-projects/001";
export const RP001_SOURCES_DIR = `${RP001_ROOT}/sources`;

export const RP001_EVALUATOR_FILES = [
  "README.md",
  "ground-truth.json",
  "source-register.json",
  "validate.py",
] as const;

type SourceRegister = {
  documents: Array<{
    id: string;
    path: string;
    issued_on: string;
    locators: string[];
    sha256: string;
  }>;
};

function isDeniedEvidencePath(filePath: string) {
  const name = basename(filePath);
  if ((RP001_EVALUATOR_FILES as readonly string[]).includes(name)) {
    return true;
  }
  const normalized = filePath.split(sep).join("/");
  return (
    /ground-truth\.json$/i.test(normalized) ||
    /source-register\.json$/i.test(normalized) ||
    /\/validate\.py$/i.test(normalized) ||
    /\/001\/README\.md$/i.test(normalized)
  );
}

export function assertEligibleRp001SourcePath(filePath: string, corpusRoot: string) {
  if (isDeniedEvidencePath(filePath)) {
    throw new Error(`Evaluator/control file is not eligible source evidence: ${basename(filePath)}`);
  }
  const root = resolve(corpusRoot);
  const sources = resolve(root, "sources");
  const resolved = resolve(filePath);
  const rel = relative(sources, resolved);
  if (rel.startsWith("..") || rel.includes("..")) {
    throw new Error("Source path is outside the RP001 sources directory");
  }
  if (rel.includes(sep) || rel.includes("/")) {
    throw new Error("RP001 sources must be files directly in sources/, not nested directories");
  }
  if (!rel.toLowerCase().endsWith(".md")) {
    throw new Error("RP001 Stage 4B sources must be Markdown files");
  }
}

export function loadRp001Register(corpusRoot = RP001_ROOT): SourceRegister {
  const register = JSON.parse(
    readFileSync(join(corpusRoot, "source-register.json"), "utf8"),
  ) as SourceRegister;
  return register;
}

export function listEligibleRp001SourceFiles(corpusRoot = RP001_ROOT) {
  const sourcesDir = join(corpusRoot, "sources");
  const names = readdirSync(sourcesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(sourcesDir, entry.name))
    .sort();
  for (const filePath of names) {
    assertEligibleRp001SourcePath(filePath, corpusRoot);
  }
  return names;
}

export function extractRp001Corpus(input: {
  corpusRoot?: string;
  documentIdFor: (sourceId: string) => string;
  companyId: string;
  projectId: string;
}): DerivedExtractionDraft[] {
  const corpusRoot = input.corpusRoot ?? RP001_ROOT;
  const register = loadRp001Register(corpusRoot);
  const files = listEligibleRp001SourceFiles(corpusRoot);
  const expectedNames = new Set(
    register.documents.map((doc) => basename(doc.path)),
  );
  const foundNames = new Set(files.map((filePath) => basename(filePath)));
  if (expectedNames.size !== 15 || foundNames.size !== 15) {
    throw new Error("RP001 corpus must contain exactly 15 source Markdown files");
  }
  for (const name of expectedNames) {
    if (!foundNames.has(name)) {
      throw new Error(`Missing RP001 source file: ${name}`);
    }
  }
  for (const name of foundNames) {
    if (!expectedNames.has(name)) {
      throw new Error(`Unexpected RP001 source file: ${name}`);
    }
  }

  return register.documents.map((doc) => {
    const filePath = join(corpusRoot, doc.path);
    assertEligibleRp001SourcePath(filePath, corpusRoot);
    const bytes = readFileSync(filePath);
    const parent: ReadyDocumentIdentity = {
      id: input.documentIdFor(doc.id),
      company_id: input.companyId,
      project_id: input.projectId,
      sha256: doc.sha256,
      status: "ready",
    };
    const draft = extractMarkdownDocument({
      parent,
      bytes,
      expectedSha256: doc.sha256,
      sourceIssuedOn: doc.issued_on,
      sourceEffectiveOn: null,
    });
    const locators = [...new Set(draft.chunks.map((chunk) => chunk.locator))];
    if (locators.join(",") !== doc.locators.join(",")) {
      throw new Error(`Locator mismatch for ${doc.id}`);
    }
    return draft;
  });
}
