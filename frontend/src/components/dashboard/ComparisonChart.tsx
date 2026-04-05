// ComparisonChart.tsx — real vs synthetic side-by-side bar chart
//
// Renders paired vertical bars using pure CSS (no chart library needed).
//   Dark blue  = real data proportion
//   Light blue = synthetic data proportion
//
// Each category (e.g. "NO", ">30", "<30") gets two bars:
//   realHeight      = (realValue / max) * 100%
//   syntheticHeight = (syntheticValue / max) * 100%
//
// max = largest value across all points — acts as the 100% baseline.
//   Math.max(10, ...) ensures bars are always at least 10% tall (prevents invisible bars).
//   The trailing 1 in Math.max(..., 1) prevents division-by-zero on empty data.

import type { ChartPoint } from "../../types/contracts";

export default function ComparisonChart({
  title,
  subtitle,
  points,
}: {
  title?: string;   // optional — omit when the parent SectionCard already shows the name
  subtitle?: string;
  points: ChartPoint[];
}) {
  // Largest value across all data points — used as the 100% height baseline
  const max = Math.max(
    ...points.flatMap((point) => [point.realValue, point.syntheticValue]),
    1 // at least 1 to avoid divide-by-zero on empty data
  );

  return (
    <div className="comparison-chart">
      {/* Title block — only rendered when title or subtitle is provided */}
      {(title || subtitle) && (
        <div className="card-header compact">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="comparison-legend">
        <span className="legend-item">
          <i className="legend-dot real" /> Real data
        </span>
        <span className="legend-item">
          <i className="legend-dot synthetic" /> Synthetic data
        </span>
      </div>

      {/* Bar chart plot area */}
      <div className="comparison-plot">
        {points.map((point) => {
          // Convert values to height percentages relative to max
          const realHeight      = `${Math.max(10, (point.realValue      / max) * 100)}%`;
          const syntheticHeight = `${Math.max(10, (point.syntheticValue / max) * 100)}%`;

          return (
            <div key={point.label} className="comparison-group">
              {/* Two bars side by side */}
              <div className="comparison-bars">
                {/* Real data bar (dark blue) */}
                <div
                  className="comparison-bar real"
                  style={{ height: realHeight }}
                  title={`Real: ${point.realValue}`}
                />
                {/* Synthetic data bar (light blue) */}
                <div
                  className="comparison-bar synthetic"
                  style={{ height: syntheticHeight }}
                  title={`Synthetic: ${point.syntheticValue}`}
                />
              </div>

              {/* Category label (e.g. "NO", ">30") */}
              <strong>{point.label}</strong>

              {/* Value label (e.g. "54% vs 53%") — raw values are 0–1 decimals, multiply by 100 */}
              <span>
                {Math.round(point.realValue * 100)}% vs {Math.round(point.syntheticValue * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
