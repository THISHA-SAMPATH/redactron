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
  let cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.action) throw new Error("missing action field");
    return parsed;
  } catch (err) {
    return { action: "unclear", reason: "Could not parse agent response.", goal_complete: false, parse_error: String(err) };
  }
}

export { SYSTEM_PROMPT, buildUserPrompt, parseAgentResponse };
