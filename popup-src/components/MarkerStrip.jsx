import React from "react";
import { motion } from "framer-motion";
import { seededRange } from "../lib/seed.js";

// Two hand-drawn marker-stroke shapes to alternate between, so repeated
// redactions in the log don't look like a stamped-out rectangle.
const SHAPES = [
  "M1 6 C2 2 8 0 15 1 C22 2 28 0 33 2 C36 3 35 8 32 9 C25 11 14 10 6 9 C2 8 0 8 1 6 Z",
  "M2 5 C4 1 11 0 18 2 C24 3 30 1 34 4 C35 6 34 9 30 9 C22 10 12 9 5 8 C1 8 0 7 2 5 Z",
];

export default function MarkerStrip({ seed = "x" }) {
  const shape = SHAPES[Math.round(seededRange(seed, 0, 1))];
  const rotate = seededRange(seed + "r", -3, 3);

  return (
    <motion.svg
      width="34"
      height="11"
      viewBox="0 0 36 11"
      style={{ flexShrink: 0, marginTop: 3, transform: `rotate(${rotate}deg)`, transformOrigin: "left center" }}
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      animate={{ clipPath: "inset(0 0% 0 0)" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <path d={shape} fill="#17130f" />
    </motion.svg>
  );
}
