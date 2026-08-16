import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Header from "./components/Header.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import GoalPanel from "./components/GoalPanel.jsx";
import ActivityLog from "./components/ActivityLog.jsx";
import { DEFAULT_PROVIDER } from "./providers.js";

let idSeq = 0;
const nextId = () => `e${idSeq++}`;

export default function App() {
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [apiKeys, setApiKeys] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [goal, setGoal] = useState("");
  const [running, setRunning] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [entries, setEntries] = useState([]);
  const [redactedCount, setRedactedCount] = useState(0);
  const flashTimer = useRef(null);

  // Load persisted config on mount
  useEffect(() => {
    chrome.storage.local.get(["llmProvider", "geminiApiKey", "groqApiKey", "anthropicApiKey"]).then((cfg) => {
      const p = cfg.llmProvider || DEFAULT_PROVIDER;
      const keys = {
        gemini: cfg.geminiApiKey || "",
        groq: cfg.groqApiKey || "",
        anthropic: cfg.anthropicApiKey || "",
      };
      setProvider(p);
      setApiKeys(keys);
      if (!keys[p]) setSettingsOpen(true);
    });
  }, []);

  // Live log stream from background.js
  useEffect(() => {
    const listener = (msg) => {
      if (msg.type !== "LOG") return;
      const entry = msg.entry;
      if (entry.type === "redaction" && entry.detail) {
        const count = Object.values(entry.detail).reduce((a, b) => a + b, 0);
        setRedactedCount((c) => c + count);
      }
      setEntries((prev) => [{ ...entry, id: nextId() }, ...prev]);
      if (["success", "warn", "error"].includes(entry.type)) setRunning(false);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const addLocalEntry = useCallback((entry) => {
    setEntries((prev) => [{ ...entry, id: nextId() }, ...prev]);
  }, []);

  const setApiKeyDraft = (id, value) => setApiKeys((prev) => ({ ...prev, [id]: value }));

  const saveKey = async () => {
    await chrome.storage.local.set({
      llmProvider: provider,
      geminiApiKey: apiKeys.gemini || "",
      groqApiKey: apiKeys.groq || "",
      anthropicApiKey: apiKeys.anthropic || "",
    });
    setSavedFlash(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlash(false), 1400);
    addLocalEntry({ type: "info", text: "API key saved." });
  };

  const startAgent = async () => {
    if (!goal.trim()) return;
    setEntries([]);
    setRedactedCount(0);
    setRunning(true);
    await chrome.runtime.sendMessage({ type: "START_AGENT", goal: goal.trim() });
  };

  const stopAgent = async () => {
    await chrome.runtime.sendMessage({ type: "STOP_AGENT" });
    setRunning(false);
  };

  const scanPage = async () => {
    setScanning(true);
    addLocalEntry({ type: "info", text: "Scanning current page…" });
    const result = await chrome.runtime.sendMessage({ type: "SCAN_PAGE" });
    setScanning(false);
    if (!result?.ok) {
      addLocalEntry({ type: "error", text: "Could not scan this page (try refreshing it)." });
      return;
    }
    if (result.hitCount) {
      setRedactedCount((c) => c + result.hitCount);
      const summary = Object.entries(result.hitsByType || {})
        .map(([k, v]) => `${v}× ${k}`)
        .join(", ");
      addLocalEntry({ type: "redaction", text: `Found & redacted: ${summary}` });
    } else {
      addLocalEntry({ type: "success", text: "No sensitive data detected on this page." });
    }
  };

  return (
    <motion.div className="app" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}>
      <Header settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((o) => !o)} running={running} />
      <SettingsPanel
        open={settingsOpen}
        provider={provider}
        setProvider={setProvider}
        apiKeys={apiKeys}
        setApiKeyDraft={setApiKeyDraft}
        onSave={saveKey}
        savedFlash={savedFlash}
      />
      <GoalPanel
        goal={goal}
        setGoal={setGoal}
        running={running}
        onStart={startAgent}
        onStop={stopAgent}
        onScan={scanPage}
        scanning={scanning}
      />
      <ActivityLog entries={entries} redactedCount={redactedCount} />
    </motion.div>
  );
}
