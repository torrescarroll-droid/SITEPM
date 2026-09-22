/** Server-only OpenAI settings. Never read from client components. */

export function getOpenAIApiKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key || null;
}

export function getOpenAIModel() {
  const model = process.env.OPENAI_MODEL?.trim();
  return model || "gpt-4o-mini";
}
