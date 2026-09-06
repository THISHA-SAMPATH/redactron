/**
 * Redactron — Background Service Worker
 *
 * This is the ONLY file in the extension allowed to make a network
 * request. It never sees raw page content — only redacted snapshots
 * relayed from the content script. The Anthropic API key lives in
 * chrome.storage.local, set from the popup, and is never hardcoded.
 */

import { SYSTEM_PROMPT, buildUserPrompt, parseAgentResponse } from "./agentLoop.js";
import { callProvider, DEFAULT_PROVIDER } from "./providers/index.js";

const MAX_STEPS = 15;

let agentState = {
  running: false,
  goal: null,
  tabId: null,
  history: [],
  stepCount: 0,
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case "START_AGENT":
      startAgent(msg.goal).catch((err) => log({ type: "error", text: String(err) }));
      sendResponse({ ok: true });
      return false;

    case "STOP_AGENT":
      agentState.running = false;
      log({ type: "info", text: "Stopped by user." });
      sendResponse({ ok: true });
      return false;

    case "SCAN_PAGE":
      relayScan().then(sendResponse);
      return true;

    case "GET_CONFIG":
      getActiveConfig().then(({ provider }) =>
        chrome.storage.local.get(["geminiApiKey", "groqApiKey", "anthropicApiKey"]).then((keys) =>
          sendResponse({ provider, keys })
        )
      );
      return true;

    default:
      return false;
  }
});

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function relayScan() {
  const tabId = await getActiveTabId();
  if (!tabId) return { ok: false, reason: "no_active_tab" };
  const result = await chrome.tabs.sendMessage(tabId, { type: "SCAN_PAGE" });
  return { ok: true, ...result };
}

async function getActiveConfig() {
  const { llmProvider, geminiApiKey, groqApiKey, anthropicApiKey } = await chrome.storage.local.get([
    "llmProvider",
    "geminiApiKey",
    "groqApiKey",
    "anthropicApiKey",
  ]);
  const provider = llmProvider || DEFAULT_PROVIDER;
  const keyMap = { gemini: geminiApiKey, groq: groqApiKey, anthropic: anthropicApiKey };
  return { provider, apiKey: keyMap[provider] };
}

async function startAgent(goal) {
  const { provider, apiKey } = await getActiveConfig();
  if (!apiKey) {
    log({ type: "error", text: `No API key set for ${provider}. Add one in Redactron settings.` });
    return;
  }

  const tabId = await getActiveTabId();
  if (!tabId) {
    log({ type: "error", text: "No active tab found." });
    return;
  }

  agentState = { running: true, goal, tabId, history: [], stepCount: 0 };
  log({ type: "info", text: `Goal set: "${goal}"` });

  while (agentState.running && agentState.stepCount < MAX_STEPS) {
    agentState.stepCount++;

    // 1. Get a redacted snapshot from the content script (on-device redaction already applied)
    const snapshotResp = await chrome.tabs.sendMessage(tabId, { type: "GET_SNAPSHOT" });
    if (!snapshotResp?.snapshot) {
      log({ type: "error", text: "Could not read page state." });
      break;
    }
    log({
      type: "redaction",
      text: `Redacted ${snapshotResp.hitCount} sensitive value(s) before sending to the model.`,
      detail: snapshotResp.hitsByType,
    });

    // 2. Ask the LLM for the next action, sending ONLY the redacted snapshot
    const action = await callAgentModel(provider, apiKey, {
      goal,
      snapshot: snapshotResp.snapshot,
      history: agentState.history,
    });

    if (action.action === "done") {
      log({ type: "success", text: action.reason || "Goal complete." });
      break;
    }
    if (action.action === "unclear") {
      log({ type: "warn", text: action.reason || "Nothing relevant found on this page." });
      break;
    }

    log({ type: "step", text: action.reason || `Proposing: ${action.action}`, action });

    // 3. Ground the action on the real page — user must confirm before it executes
    let groundResult = await chrome.tabs.sendMessage(tabId, { type: "PROPOSE_ACTION", action });

    // A stale/not-visible/no-match result usually just means the page re-rendered
    // between the snapshot we sent the model and now (normal on React/Vue/Angular
    // sites). Refresh the content script's element registry once and retry the
    // SAME action — resolveElement() will fail on the old rid, so this falls
    // through to fuzzyResolve(action.target_description, ...) against the fresh
    // snapshot, which is exactly the fallback the model was told to provide.
    const RETRYABLE = new Set(["stale_element", "element_not_visible", "no_matching_element"]);
    if (!groundResult?.ok && RETRYABLE.has(groundResult?.reason)) {
      log({ type: "info", text: "Page changed since the last look — refreshing and retrying this step." });
      const refreshed = await chrome.tabs.sendMessage(tabId, { type: "GET_SNAPSHOT" });
      if (refreshed?.snapshot) {
        groundResult = await chrome.tabs.sendMessage(tabId, { type: "PROPOSE_ACTION", action });
      }
    }

    if (!groundResult?.ok) {
      log({ type: "warn", text: "Could not locate that element on the page. Stopping." });
      break;
    }
    if (!groundResult.executed) {
      log({ type: "info", text: "Step skipped by user." });
      break;
    }

    agentState.history.push({ action: action.action, reason: action.reason, rid: action.rid });

    // brief pause to let the page react (navigation, re-render) before next snapshot
    await new Promise((r) => setTimeout(r, 900));
  }

  if (agentState.stepCount >= MAX_STEPS) {
    log({ type: "warn", text: "Stopped after reaching the step limit." });
  }
  agentState.running = false;
}

async function callAgentModel(provider, apiKey, { goal, snapshot, history }) {
  const userPrompt = buildUserPrompt({ goal, snapshot, history });

  let text;
  try {
    text = await callProvider(provider, apiKey, SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    log({ type: "error", text: String(err.message || err) });
    return { action: "unclear", reason: "Model call failed.", goal_complete: false };
  }

  return parseAgentResponse(text);
}

function log(entry) {
  chrome.runtime.sendMessage({ type: "LOG", entry: { ...entry, ts: Date.now() } }).catch(() => {});
}