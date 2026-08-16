import React from "react";
import { motion } from "framer-motion";
import { Play, Square, ScanEye, Loader2 } from "lucide-react";

export default function GoalPanel({ goal, setGoal, running, onStart, onStop, onScan, scanning }) {
  return (
    <section className="goal-section">
      <label className="field-label" htmlFor="goalInput">
        What are you trying to do on this page?
      </label>
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
        >
          <span className="btn-inline">
            {running ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
            {running ? "Guiding…" : "Start guiding"}
          </span>
        </motion.button>
        <motion.button
          className="btn btn-secondary"
          disabled={!running}
          onClick={onStop}
          whileTap={{ scale: 0.96 }}
        >
          <span className="btn-inline">
            <Square size={12} />
            Stop
          </span>
        </motion.button>
      </div>

      <motion.button className="btn btn-ghost" onClick={onScan} whileTap={{ scale: 0.98 }} whileHover={{ borderColor: "rgba(244,241,234,0.3)" }}>
        <span className="btn-inline">
          {scanning ? <Loader2 size={13} className="spin" /> : <ScanEye size={13} />}
          Scan page for sensitive data (no LLM call)
        </span>
      </motion.button>
    </section>
  );
}
