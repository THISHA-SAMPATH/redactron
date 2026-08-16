import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, MousePointerClick, EyeOff, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const ICONS = {
  info: Info,
  step: MousePointerClick,
  redaction: EyeOff,
  success: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
};

function RedactCounter({ count }) {
  return (
    <span className="redact-count">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={count}
          className="redact-count-num"
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
      &nbsp;redacted
    </span>
  );
}

export default function ActivityLog({ entries, redactedCount }) {
  return (
    <section className="log-section">
      <div className="log-header">
        <span>Activity</span>
        <RedactCounter count={redactedCount} />
      </div>

      <div className="log">
        <AnimatePresence initial={false}>
          {entries.length === 0 && (
            <motion.div
              key="empty"
              className="log-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              No activity yet.
            </motion.div>
          )}
          {entries.map((entry) => {
            const Icon = ICONS[entry.type] || Info;
            return (
              <motion.div
                key={entry.id}
                className={`log-entry log-entry-${entry.type}`}
                layout
                initial={{ opacity: 0, x: -8, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {entry.type === "redaction" && (
                  <motion.span
                    className="redact-strip"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                )}
                <Icon size={13} className="log-icon" />
                <span className="log-text">{entry.text}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
