/**
 * Jiti-loadable production modules for the 4F-D hosted harness.
 * Test-only import surface. Not a generic SQL client.
 */
export {
  persistReadyPdfExtraction,
  downloadCanonicalProjectDocument,
  DerivedExtractionPersistError,
} from "@/lib/document-extraction-persist";
export { persistDerivedDocumentExtraction } from "@/lib/document-extractor-db";
export { extractPdfDocument } from "@/lib/document-extract";
export {
  assembleAskEvidencePack,
  documentChunkEvidenceItem,
  documentChunkCitationLabel,
} from "@/lib/ask-evidence";
export { generateGroundedAnswer, ASK_SYSTEM_PROMPT } from "@/lib/ai/provider";
export {
  STAGE_4F_D_FILENAME,
  STAGE_4F_D_PROMPT_FILENAME,
  STAGE_4F_D_PROMPT_TOKEN,
  STAGE_4F_D_TOKEN_PAGE1,
  STAGE_4F_D_TOKEN_PAGE2,
  stage4fDDistinctivePdf,
  stage4fDPromptLikePdf,
  buildImageOnlyPdf,
  buildMalformedPdf,
  buildEncryptedPdf,
} from "./pdf-text-extract-fixtures";
