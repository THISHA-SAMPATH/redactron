import React from "react";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";

export default function Header({ settingsOpen, onToggleSettings }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark">
          <div className="redact-bar">
            <motion.span
              className="redact-bar-wipe"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: [0, 1, 1, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.35, 0.7, 1], ease: "easeInOut" }}
            />
          </div>
        </div>
        <div className="brand-text">
          <span className="brand-name">Redactron</span>
          <span className="brand-sub">on-device redaction · any website</span>
        </div>
      </div>
      <motion.button
        className={`icon-btn ${settingsOpen ? "icon-btn-active" : ""}`}
        onClick={onToggleSettings}
        whileTap={{ scale: 0.9 }}
        whileHover={{ rotate: 25 }}
        aria-label="Settings"
      >
        <Settings size={15} strokeWidth={2.25} />
      </motion.button>
    </header>
  );
}
