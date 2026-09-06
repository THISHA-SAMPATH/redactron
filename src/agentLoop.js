/**
 * Redactron — Agent Loop
 *
 * Pure logic: turns (goal, redacted snapshot, history) into a prompt,
 * and turns the LLM's text response into a structured action.
 * No network calls live here — background.js owns the fetch.
 */

const SYSTEM_PROMPT = `You are a UI navigation agent embedded in a browser extension.
You are given:
- a user's goal in plain language
- a REDACTED snapshot of the current page's interactive elements (sensitive values have been replaced with tokens like [EMAIL_1], [AWS_ACCOUNT_ID_1] — never invent what they might be)
- a short history of actions already taken

Decide the SINGLE next best action to move the user toward their goal.
Respond with ONLY a JSON object, no prose, no markdown fences, in this exact shape:

{
  "action": "click" | "fill" | "focus" | "done" | "unclear",
  "rid": "<rid of the target element from the snapshot, if applicable>",
  "target_description": "<short human description of the element, used as a fallback if rid resolution fails>",
  "value": "<text to fill, only for action=fill>",
  "reason": "<one short sentence explaining this step to the user, e.g. 'Click Create bucket to start'>",
  "goal_complete": true | false
}

Rules:
- Only ever propose ONE action per turn.
- If the goal appears complete based on the page state, return action: "done", goal_complete: true.
- If nothing on the page looks relevant to the goal, return action: "unclear", goal_complete: false.
- Never reference or guess the original value behind a redaction token — treat it as opaque.
- Prefer elements with clear labels/roles over ambiguous ones.
- For destructive-sounding actions (delete, terminate, remove) still just propose them — the extension always asks the human to confirm before anything executes.`;

function buildUserPrompt({ goal, snapshot, history }) {
  const elementsBrief = snapshot.elements.map((el) => ({
    rid: el.rid,
    tag: el.tag,
    role: el.role,
    label: el.label,
    text: el.text?.slice(0, 80),
    placeholder: el.placeholder,
    disabled: el.disabled,
  }));

  return JSON.stringify(
    {
      goal,
      page: { url: snapshot.url, title: snapshot.title },
      elements: elementsBrief,
      history: history.slice(-6), // last few steps only, keep prompt small
    },
    null,
    0
  );
}

function parseAgentResponse(text) {
  // Real-world free-tier models (Gemini Flash, Llama on Groq) frequently ignore
  // "respond with ONLY JSON" and wrap it in fences, add a leading/trailing
  // sentence, use single quotes, or leave a trailing comma. A naive
  // JSON.parse(trim()) fails on most of these — tested against 8 realistic
  // response shapes and it only parsed 2/8. This applies a few safe, ordered
  // repairs and only falls back to "unclear" if all of them still fail.
  let cleaned = text.trim();

  // 1. Strip code fences, with or without a language tag, wherever they are
  //    (some models fence just the JSON in the middle of a sentence).
  cleaned = cleaned.replace(/```[a-z]*\s*/gi, "").replace(/```/g, "").trim();

  // 2. If there's leading/trailing prose around the object, slice out just
  //    the outermost {...}. Safe here because the schema is a single flat
  //    JSON object with no nested braces of its own.
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  // 3. Try strict parsing first.
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.action) throw new Error("missing action field");
    return parsed;
  } catch (_) {
    // fall through to best-effort repairs below
  }

  // 4. Common, low-risk repairs: trailing commas before a closing brace/bracket,
  //    then single-quoted keys/values (only attempted if strict parsing failed,
  //    since blindly swapping quotes could corrupt a value that legitimately
  //    contains an apostrophe, e.g. a "reason" describing a "Steve's Store" button).
  const repaired = cleaned
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/'([^']*)'/g, '"$1"');

  try {
    const parsed = JSON.parse(repaired);
    if (!parsed.action) throw new Error("missing action field");
    return parsed;
  } catch (err) {
    return { action: "unclear", reason: "Could not parse agent response.", goal_complete: false, parse_error: String(err) };
  }
}

export { SYSTEM_PROMPT, buildUserPrompt, parseAgentResponse };