import React from "react";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";

export default function Header({ settingsOpen, onToggleSettings, running }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark">
          <div className="redact-bar">
            <motion.span
              className="redact-bar-wipe"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: [0, 1, 1, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, times: [0, 0.35, 0.7, 1], ease: "easeInOut" }}
            />
          </div>
        </div>
        <div className="brand-text">
          <div className="brand-name-row">
            <span className="brand-name">Redactron</span>
            <span className="brand-cursor" />
          </div>
          <span className="brand-sub">on-device redaction · any website</span>
        </div>
      </div>

      <div className="header-right">
        <span className={`status-pill ${running ? "status-active" : "status-ready"}`}>
          <span className="status-dot" />
          {running ? "active" : "ready"}
        </span>
        <motion.button
          className={`icon-btn ${settingsOpen ? "icon-btn-active" : ""}`}
          onClick={onToggleSettings}
          whileTap={{ scale: 0.9 }}
          whileHover={{ rotate: 35 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          aria-label="Settings"
        >
          <Settings size={14} strokeWidth={2.25} />
        </motion.button>
      </div>
    </header>
  );
}
