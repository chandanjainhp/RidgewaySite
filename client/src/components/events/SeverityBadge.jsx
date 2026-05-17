import { memo } from "react";
import { AlertTriangle, Circle, CheckCircle, HelpCircle } from "lucide-react";
import { SEVERITY_CONFIG } from "@/config/constants";

const SEVERITY_RGB = {
  harmless: "34, 197, 94",
  monitor: "245, 158, 11",
  escalate: "239, 68, 68",
  uncertain: "99, 102, 241",
  unknown: "74, 85, 104",
};

// Map both new (serious/minor) and legacy (escalate/monitor) names to icon + config key.
const SEVERITY_ALIAS = {
  serious: "escalate",
  minor: "monitor",
};

const SEVERITY_ICON = {
  escalate: AlertTriangle,
  monitor: Circle,
  harmless: CheckCircle,
  uncertain: HelpCircle,
  unknown: HelpCircle,
};

function SeverityBadge({ severity }) {
  const raw =
    typeof severity === "string" && severity.trim().length > 0
      ? severity.toLowerCase()
      : "unknown";
  const normalized = SEVERITY_ALIAS[raw] || raw;
  const key = SEVERITY_CONFIG[normalized] ? normalized : "unknown";
  const config = SEVERITY_CONFIG[key];
  const rgb = SEVERITY_RGB[key] || SEVERITY_RGB.unknown;
  const Icon = SEVERITY_ICON[key] || HelpCircle;

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
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  };

  return (
    <span style={badgeStyle}>
      <Icon size={12} aria-hidden="true" style={{ color: config.color }} />
      {config.label.toUpperCase()}
    </span>
  );
}

export default memo(SeverityBadge);
