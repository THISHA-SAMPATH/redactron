/**
 * Redactron — Anthropic provider adapter
 * Kept as an option for users with API credits; not the default,
 * since it has no ongoing free tier.
 */

const MODEL = "claude-sonnet-4-6";

export async function callAnthropic(apiKey, systemPrompt, userPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.content?.find((b) => b.type === "text")?.text || "";
}
