export type AskComposerKeyIntent = "submit" | "newline" | "default";

/** Enter submits. Shift+Enter keeps the textarea newline. */
export function askComposerKeyIntent(
  key: string,
  shiftKey: boolean,
): AskComposerKeyIntent {
  if (key !== "Enter") return "default";
  if (shiftKey) return "newline";
  return "submit";
}

/** Shared gate for the Ask button and the Enter key. */
export function shouldSubmitAskQuestion(question: string, pending: boolean) {
  return !pending && question.trim().length > 0;
}
