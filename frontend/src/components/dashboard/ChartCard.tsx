// ChartCard.tsx — wrapper card for all chart panels
//
// Every chart panel needs the same four things the supervisor requires:
//   title, x-axis label, y-axis label, legend (handled by the child chart)
//
// Layout when hasData is true:
//   [card header: title + subtitle]
//   [y-axis label rotated] | [chart content]
//                          | [x-axis label]
//
// Layout when hasData is false:
//   [card header]
//   [centered empty message]

import type { ChartCardProps } from "../../types/contracts";

export default function ChartCard({
  title,
  subtitle,
  xAxisLabel,
  yAxisLabel,
  hasData,
  emptyMessage = "No data available.",
  children,
}: ChartCardProps) {
  return (
    <div className="section-card">
      <div className="card-header">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="chart-card-body">
        {hasData ? (
          <div className="chart-layout">
            {/* Y-axis label — rotated 90° on the left */}
            <span className="y-axis-label">{yAxisLabel}</span>

            {/* Chart area: chart content + x-axis label below */}
            <div className="chart-area">
              {children}
              <span className="x-axis-label">{xAxisLabel}</span>
            </div>
          </div>
        ) : (
          <p className="chart-card-empty">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
