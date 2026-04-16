"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { formatConfidence } from "@/lib/formatters";

const getBarColor = (value) => {
  if (value === null || value === undefined) return "#4a5568";
  if (value > 0.8) return "#22c55e";
  if (value >= 0.5) return "#f59e0b";
  if (value >= 0.3) return "#f97316";
  return "#ef4444";
};

const ConfidenceBar = memo(({ confidence, showLabel = true, size = "sm" }) => {
  const isUnknown = confidence === null || confidence === undefined;
  const value = isUnknown ? 0.5 : Math.min(1, Math.max(0, confidence));
  const color = getBarColor(isUnknown ? null : confidence);
  const trackHeight = size === "md" ? "h-1.5" : "h-1";

  const { label } = isUnknown
    ? { label: "Confidence unknown" }
    : formatConfidence(confidence);

  return (
    <div className="w-full flex flex-col gap-1">
      <div className={`w-full ${trackHeight} bg-surface-3 rounded-full overflow-hidden`}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {showLabel && (
        <span
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: isUnknown ? "#4a5568" : color }}
        >
          {label}
        </span>
      )}
    </div>
  );
});

ConfidenceBar.displayName = "ConfidenceBar";

export default ConfidenceBar;
