import { memo } from "react";
import { SEVERITY_CONFIG } from "@/config/constants";

const SEVERITY_RGB = {
  harmless: "34, 197, 94",
  monitor: "245, 158, 11",
  escalate: "239, 68, 68",
  uncertain: "99, 102, 241",
  unknown: "74, 85, 104",
};

function SeverityBadge({ severity }) {
  const normalizedSeverity =
    typeof severity === "string" && severity.trim().length > 0
      ? severity.toLowerCase()
      : "unknown";

  const key = SEVERITY_CONFIG[normalizedSeverity] ? normalizedSeverity : "unknown";
  const config = SEVERITY_CONFIG[key];
  const rgb = SEVERITY_RGB[key] || SEVERITY_RGB.unknown;

  const badgeStyle = {
    background: "rgba(" + rgb + ", 0.15)",
    border: "1px solid rgba(" + rgb + ", 0.4)",
    color: config.color,
    fontSize: "10px",
    fontFamily: "monospace",
    fontWeight: 600,
    letterSpacing: "0.08em",
    padding: "3px 8px",
    borderRadius: "4px",
    display: "inline-block",
  };

  return <span style={badgeStyle}>{config.label.toUpperCase()}</span>;
}

export default memo(SeverityBadge);
