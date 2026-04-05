// MetricBadgeList.tsx — renders a list of strings as blue badges
//
// Example input: ["KS Test", "Chi-square Test"]
// Output:        [KS Test] [Chi-square Test]
//
// Used in SetupPage and ResultsPage to display selected metrics.

import StatusBadge from "./StatusBadge";
import type { MetricBadgeListProps } from "../../types/contracts";

export default function MetricBadgeList({ items }: MetricBadgeListProps) {
  return (
    <div className="metric-badge-list">
      {items.map((item) => (
        <StatusBadge key={item} tone="info">
          {item}
        </StatusBadge>
      ))}
    </div>
  );
}
