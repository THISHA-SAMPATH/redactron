import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Check } from "lucide-react";
import { PROVIDER_LIST } from "../providers.js";

export default function SettingsPanel({
  open,
  provider,
  setProvider,
  apiKeys,
  setApiKeyDraft,
  onSave,
  savedFlash,
}) {
  const active = PROVIDER_LIST.find((p) => p.id === provider) || PROVIDER_LIST[0];
  const rowRef = useRef(null);
  const chipRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = chipRefs.current[provider];
    const row = rowRef.current;
    if (el && row) {
      const rowRect = row.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({ left: elRect.left - rowRect.left, width: elRect.width });
    }
  }, [provider, open]);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          className="settings-panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
        >
          <div className="settings-inner">
            <span className="field-label">model provider</span>
            <div className="provider-pillrow" ref={rowRef}>
              <motion.div
                className="provider-pill-indicator"
                animate={{ left: indicator.left, width: indicator.width }}
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
              />
              {PROVIDER_LIST.map((p) => (
                <button
                  key={p.id}
                  ref={(el) => (chipRefs.current[p.id] = el)}
                  className={`chip ${provider === p.id ? "chip-active" : ""}`}
                  onClick={() => setProvider(p.id)}
                >
                  {p.label}
                  <span className={`chip-tag ${p.tag === "free" ? "chip-tag-free" : "chip-tag-paid"}`}>{p.tag}</span>
                </button>
              ))}
            </div>

            <motion.div
              key={provider}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <span className="field-label" style={{ marginTop: 12 }}>
                {active.label.toLowerCase()} api key
              </span>
              <input
                className="text-input"
                type="password"
                placeholder={active.keyHint}
                value={apiKeys[provider] || ""}
                onChange={(e) => setApiKeyDraft(provider, e.target.value)}
              />
              <div className="settings-actions">
                <motion.button
                  className="btn btn-primary btn-compact"
                  onClick={onSave}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {savedFlash ? (
                      <motion.span
                        key="saved"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="btn-inline"
                      >
                        <Check size={13} /> saved
                      </motion.span>
                    ) : (
                      <motion.span key="save" className="btn-inline">
                        save key
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
                <a className="key-link" href={active.getKeyUrl} target="_blank" rel="noreferrer">
                  get a {active.tag} key <ExternalLink size={11} />
                </a>
              </div>
              <span className="handnote">psst — this never leaves your device unredacted</span>
            </motion.div>

            <p className="hint">stored locally via chrome.storage — sent only from the background worker directly to the provider's api.</p>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
