// StatusBadge.tsx — coloured inline label
//
// Renders a small pill-shaped badge to indicate status or category.
//
// tone values and their colours:
//   info    → blue   (neutral information)
//   success → green  (all good)
//   warning → yellow (needs attention)
//   danger  → red    (error or critical)
//
// This is the smallest component in the app, but the most widely reused:
// DataTable status columns, InfoAlert levels, SummaryCard badges, etc.

import type { StatusBadgeProps } from "../../types/contracts";

export default function StatusBadge({
  children,
  tone = "info", // default: blue
}: StatusBadgeProps) {
  // tone is appended to the class name — CSS rules in index.css handle the colour
  return <span className={`status-badge ${tone}`}>{children}</span>;
}
