export const RELEASE_PAUSE_MESSAGE =
  "Writes are briefly paused for a release. Keep your draft and retry the same submission when the release is complete.";

export function isReleasePaused(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return ["PT503", "55000"].includes(value.code ?? "") &&
    value.message === "SITEPM_RELEASE_PAUSED";
}
