/**
 * Redactron — Provider registry
 *
 * Single entry point background.js uses to call whichever LLM is
 * configured. Every adapter takes (apiKey, systemPrompt, userPrompt)
 * and returns a plain text string — swapping providers never touches
 * the redaction, extraction, or grounding logic.
 */

import { callGemini } from "./gemini.js";
import { callGroq } from "./groq.js";
import { callAnthropic } from "./anthropic.js";

export const PROVIDERS = {
  gemini: {
    label: "Gemini (free)",
    call: callGemini,
    keyHint: "AIza...",
    getKeyUrl: "https://aistudio.google.com/apikey",
  },
  groq: {
    label: "Groq (free)",
    call: callGroq,
    keyHint: "gsk_...",
    getKeyUrl: "https://console.groq.com/keys",
  },
  anthropic: {
    label: "Claude (paid)",
    call: callAnthropic,
    keyHint: "sk-ant-...",
    getKeyUrl: "https://console.anthropic.com",
  },
};

export const DEFAULT_PROVIDER = "gemini";

export async function callProvider(providerId, apiKey, systemPrompt, userPrompt) {
  const provider = PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];
  return provider.call(apiKey, systemPrompt, userPrompt);
}
