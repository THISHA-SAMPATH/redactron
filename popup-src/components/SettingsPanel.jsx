import React from "react";
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

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.section
          className="settings-panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="settings-inner">
            <span className="field-label">Model provider</span>
            <div className="provider-chips">
              {PROVIDER_LIST.map((p) => (
                <motion.button
                  key={p.id}
                  className={`chip ${provider === p.id ? "chip-active" : ""}`}
                  onClick={() => setProvider(p.id)}
                  whileTap={{ scale: 0.95 }}
                  layout
                >
                  {p.label}
                  <span className={`chip-tag ${p.tag === "free" ? "chip-tag-free" : "chip-tag-paid"}`}>{p.tag}</span>
                </motion.button>
              ))}
            </div>

            <motion.div
              key={provider}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <span className="field-label" style={{ marginTop: 12 }}>
                {active.label} API key
              </span>
              <input
                className="text-input"
                type="password"
                placeholder={active.keyHint}
                value={apiKeys[provider] || ""}
                onChange={(e) => setApiKeyDraft(provider, e.target.value)}
              />
              <div className="settings-actions">
                <motion.button className="btn btn-primary btn-compact" onClick={onSave} whileTap={{ scale: 0.96 }}>
                  <AnimatePresence mode="wait" initial={false}>
                    {savedFlash ? (
                      <motion.span
                        key="saved"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="btn-inline"
                      >
                        <Check size={13} /> Saved
                      </motion.span>
                    ) : (
                      <motion.span key="save" className="btn-inline">
                        Save key
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
                <a className="key-link" href={active.getKeyUrl} target="_blank" rel="noreferrer">
                  Get a {active.tag} key <ExternalLink size={11} />
                </a>
              </div>
            </motion.div>

            <p className="hint">Stored locally via chrome.storage — sent only from the background worker directly to the provider's API.</p>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
