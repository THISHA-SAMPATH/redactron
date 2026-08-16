import React from "react";
import { motion } from "framer-motion";

export default function DoodleArrow() {
  return (
    <svg className="doodle-arrow" viewBox="0 0 46 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <motion.path
        d="M40 4 C 30 6, 14 10, 8 22 C 5 28, 6 32, 9 34"
        stroke="#a83e2c"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
      />
      <motion.path
        d="M3 27 L9 34 L15 29"
        stroke="#a83e2c"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut", delay: 0.8 }}
      />
    </svg>
  );
}
