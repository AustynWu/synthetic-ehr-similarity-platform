// SummaryCard.tsx — single-stat summary card
//
// Shows one number or text value with a label and optional helper text.
// Commonly used in the top summary row of a page.
//
// Structure:
//   label (small)         [badge]
//   value (large, h3)
//   helper (smallest, grey)
//
// All props except label and value are optional.
// Simplest usage:  <SummaryCard label="Rows" value={101766} />
// Full usage:      <SummaryCard label="Status" value="Good" badge="OK" tone="success" helper="..." />

import StatusBadge from "./StatusBadge";
import type { SummaryCardProps } from "../../types/contracts";

export default function SummaryCard({
  label,
  value,
  helper,
  tone = "info",
  badge,
  tooltip,
}: SummaryCardProps) {
  return (
    <div className="summary-card">
      {/* Top row: label on the left, badge on the right */}
      <div className="summary-top-row">
        <p>{label}</p>
        {badge ? <StatusBadge tone={tone}>{badge}</StatusBadge> : null}
      </div>

      {/* Main value */}
      <h3>{value}</h3>

      {/* Helper text with optional ⓘ tooltip */}
      {(helper || tooltip) ? (
        <div className="summary-helper-row">
          {helper ? <span>{helper}</span> : null}
          {tooltip ? (
            <span className="summary-tooltip-anchor">
              ⓘ
              <span className="summary-tooltip-box">{tooltip}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
