// InfoAlert.tsx — validation issue list
//
// Shows validation issues grouped by severity: errors first, then warnings, then info.
// A summary count line at the top lets users see at a glance how many issues exist.
//
// Colour mapping:
//   error   → danger  (red)
//   warning → warning (yellow)
//   info    → info    (blue)

import StatusBadge from "./StatusBadge";
import type { InfoAlertProps, ValidationIssue } from "../../types/contracts";

// Severity order: errors must appear before warnings, warnings before info.
const LEVEL_ORDER: ValidationIssue["level"][] = ["error", "warning", "info"];

export default function InfoAlert({ title, items }: InfoAlertProps) {
  // Count issues per level for the summary line
  const errorCount   = items.filter((i) => i.level === "error").length;
  const warningCount = items.filter((i) => i.level === "warning").length;
  const infoCount    = items.filter((i) => i.level === "info").length;

  // Build a human-readable summary, e.g. "2 errors · 5 warnings · 1 info"
  const summaryParts: string[] = [];
  if (errorCount   > 0) summaryParts.push(`${errorCount} error${errorCount   > 1 ? "s" : ""}`);
  if (warningCount > 0) summaryParts.push(`${warningCount} warning${warningCount > 1 ? "s" : ""}`);
  if (infoCount    > 0) summaryParts.push(`${infoCount} info`);
  const summary = summaryParts.join(" · ");

  // Badge tone shown in the header — red if any errors, yellow if only warnings, blue otherwise
  const headerTone = errorCount > 0 ? "danger" : warningCount > 0 ? "warning" : "info";

  // Sort items: errors first, then warnings, then info
  const sorted = [...items].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
  );

  return (
    <div className="info-alert">
      <div className="card-header">
        <h3>{title}</h3>
        <StatusBadge tone={headerTone}>{summary || "No issues"}</StatusBadge>
      </div>

      <ul className="insight-list">
        {sorted.map((item) => (
          // key uses code + message to guarantee uniqueness
          <li key={`${item.code}-${item.message}`}>
            <StatusBadge
              tone={
                item.level === "error"   ? "danger"  :
                item.level === "warning" ? "warning" :
                "info"
              }
            >
              {item.level}
            </StatusBadge>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
