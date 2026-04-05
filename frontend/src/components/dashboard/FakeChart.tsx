// FakeChart.tsx — prototype horizontal bar chart (CSS only, no chart library)
//
// Renders visual bars using inline CSS width — no SVG or external dependencies.
// Goal: make the dashboard look populated without spending time on a real chart.
//
// Each bar:
//   label | value
//   ████████████░░░░  (width = bar.percent%)
//
// To upgrade later: replace this component with Recharts or Chart.js.
// Pages that use it won't need to change.

import type { FakeChartProps } from "../../types/contracts";

export default function FakeChart({
  title,
  bars = [],    // default empty array prevents undefined errors
  height = 220, // default min-height in px
}: FakeChartProps) {
  return (
    // minHeight set via inline style (React uses camelCase: minHeight, not min-height)
    <div className="fake-chart" style={{ minHeight: height }}>
      <div className="card-header compact">
        <h3>{title}</h3>
        <p>Prototype visual placeholder</p>
      </div>

      <div className="bar-visual-list">
        {bars.map((bar) => (
          <div key={bar.label} className="bar-row">
            {/* Label on the left, value on the right */}
            <div className="bar-meta">
              <span>{bar.label}</span>
              <strong>{bar.value}</strong>
            </div>

            {/* Bar track with fill width controlled by percent */}
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${bar.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
