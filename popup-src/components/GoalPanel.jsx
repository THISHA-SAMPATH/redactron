import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Square, ScanEye, Loader2 } from "lucide-react";
import DoodleArrow from "./DoodleArrow.jsx";

export default function GoalPanel({ goal, setGoal, running, onStart, onStop, onScan, scanning }) {
  const showDoodle = !goal.trim() && !running;

  return (
    <section className="goal-section">
      <label className="field-label" htmlFor="goalInput">
        what are you trying to do on this page?
      </label>

      <AnimatePresence>
        {showDoodle && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <span className="doodle-label">type here</span>
            <DoodleArrow />
          </motion.div>
        )}
      </AnimatePresence>

      <textarea
        id="goalInput"
        className="text-input"
        rows={2}
        placeholder="e.g. create a new storage bucket"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        disabled={running}
      />

      <div className="btn-row">
        <motion.button
          className="btn btn-primary"
          disabled={running || !goal.trim()}
          onClick={onStart}
          whileTap={{ scale: 0.96 }}
          whileHover={!running && goal.trim() ? { y: -1 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          <span className="btn-inline">
            {running ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
            {running ? "guiding…" : "start guiding"}
          </span>
        </motion.button>
        <motion.button
          className="btn btn-secondary"
          disabled={!running}
          onClick={onStop}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          <span className="btn-inline">
            <Square size={12} />
            stop
          </span>
        </motion.button>
      </div>

      <motion.button
        className="btn btn-ghost"
        onClick={onScan}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        <span className="btn-inline">
          {scanning ? <Loader2 size={13} className="spin" /> : <ScanEye size={13} />}
          scan page for sensitive data (no llm call)
        </span>
      </motion.button>
    </section>
  );
}
