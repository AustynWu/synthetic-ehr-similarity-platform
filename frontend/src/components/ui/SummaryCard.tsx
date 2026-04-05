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
  tone = "info",  // default badge colour: blue
  badge,          // optional top-right label
}: SummaryCardProps) {
  return (
    <div className="summary-card">
      {/* Top row: label on the left, badge on the right */}
      <div className="summary-top-row">
        <p>{label}</p>
        {/* null/undefined is not rendered by React — safe to use as a conditional */}
        {badge ? <StatusBadge tone={tone}>{badge}</StatusBadge> : null}
      </div>

      {/* Main value */}
      <h3>{value}</h3>

      {/* Optional supplementary note */}
      {helper ? <span>{helper}</span> : null}
    </div>
  );
}
