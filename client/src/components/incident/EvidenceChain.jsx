"use client";

import { motion } from "framer-motion";
import EvidenceStep from "@/components/incident/EvidenceStep";

export default function EvidenceChain({ steps, finalClassification }) {
  if (!steps || steps.length === 0) {
    return (
      <div className="text-text-muted font-mono text-xs uppercase tracking-widest p-4 border border-dashed border-border/50 text-center">
        Evidence chain not yet available
      </div>
    );
  }

  const toConfidenceLevel = (score) => {
    const numericScore = Number(score);
    if (Number.isNaN(numericScore)) return "uncertain";
    if (numericScore >= 0.8) return "high";
    if (numericScore >= 0.5) return "medium";
    if (numericScore > 0) return "low";
    return "uncertain";
  };

  return (
    <div className="flex flex-col w-full font-sans relative">
      {steps.map((stepInfo, idx) => {
        const { step, finding, source, confidence } = stepInfo;
        const isLastStep = !finalClassification && idx === steps.length - 1;

        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.3 }}
            className="w-full"
          >
            <EvidenceStep
              step={step || idx + 1}
              finding={finding}
              source={source}
              confidence={confidence}
              isFirst={idx === 0}
              isLast={isLastStep}
            />
          </motion.div>
        );
      })}

      {finalClassification && (
        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: steps.length * 0.1, duration: 0.4 }}
           className="w-full"
        >
          <EvidenceStep
            step={steps.length + 1}
            source="classify_incident"
            finding={`Assessed as ${finalClassification.severity || "uncertain"} with ${Math.round((finalClassification.confidence || 0) * 100)}% confidence`}
            confidence={toConfidenceLevel(finalClassification.confidence)}
            isFirst={steps.length === 0}
            isLast
          />
        </motion.div>
      )}
    </div>
  );
}
