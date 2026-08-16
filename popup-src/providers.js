export const PROVIDER_LIST = [
  {
    id: "gemini",
    label: "Gemini",
    tag: "free",
    keyHint: "AIza...",
    getKeyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "groq",
    label: "Groq",
    tag: "free",
    keyHint: "gsk_...",
    getKeyUrl: "https://console.groq.com/keys",
  },
  {
    id: "anthropic",
    label: "Claude",
    tag: "paid",
    keyHint: "sk-ant-...",
    getKeyUrl: "https://console.anthropic.com",
  },
];

export const DEFAULT_PROVIDER = "gemini";
