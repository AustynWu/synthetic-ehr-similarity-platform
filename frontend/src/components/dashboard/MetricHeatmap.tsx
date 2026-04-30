// ========================================================
// MetricHeatmap.tsx — variable × metric score heatmap
// ========================================================
// Renders a grid where:
//   rows    = variables (from metricMatrix.variables)
//   columns = metrics  (from metricMatrix.metrics)
//   cell    = normalizedScore (0-1), coloured green / yellow / red
//   empty   = metric does not apply to this variable type
//
// The cells array is sparse: only applicable (variable, metric)
// pairs exist. Missing cells render as a grey "—" placeholder.
//
// Short metric labels are used to keep columns narrow.
// ========================================================

import type { MetricMatrix } from "../../types/contracts";
import { getVariableDisplayName } from "../../utils/variableNames";

// Abbreviated column headers — keeps the table narrow
const SHORT_LABELS: Record<string, string> = {
  mean_difference:                   "Mean Diff",
  ks_test:                           "KS Test",
  wasserstein_distance:              "Wasserstein",
  chi_square:                        "Chi-sq",
  category_proportion_difference:    "Cat. Prop",
  correlation_difference:            "Correlation",
  numerical_categorical_association: "Num-Cat",
  cramers_v_comparison:              "Cramér's V",
};

// Thresholds match Task 6: ≥0.85 Good, 0.70–0.84 Review, <0.70 Poor
function cellStyle(score: number): { background: string; color: string } {
  if (score >= 0.85) return { background: "var(--success-soft)", color: "var(--success)" };
  if (score >= 0.70) return { background: "var(--warning-soft)", color: "var(--warning)" };
  return { background: "var(--danger-soft)", color: "var(--danger)" };
}

export default function MetricHeatmap({ matrix }: { matrix: MetricMatrix }) {
  // Build a fast lookup: "variable__metric" → normalizedScore
  const lookup = new Map(
    matrix.cells.map((c) => [`${c.variable}__${c.metric}`, c.normalizedScore])
  );

  return (
    <div className="heatmap-scroll-wrapper">
      <table className="heatmap-table">
        <thead>
          <tr>
            <th className="heatmap-corner" />
            {matrix.metrics.map((metric) => (
              <th key={metric} className="heatmap-col-header" title={metric}>
                {SHORT_LABELS[metric] ?? metric}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.variables.map((variable) => (
            <tr key={variable}>
              {/* Show display name; raw name in tooltip */}
              <td className="heatmap-row-header" title={variable}>
                {getVariableDisplayName(variable)}
              </td>
              {matrix.metrics.map((metric) => {
                const score = lookup.get(`${variable}__${metric}`);
                if (score === undefined) {
                  return <td key={metric} className="heatmap-cell na">—</td>;
                }
                const { background, color } = cellStyle(score);
                return (
                  <td
                    key={metric}
                    className="heatmap-cell"
                    style={{ background, color }}
                    title={`${getVariableDisplayName(variable)} × ${SHORT_LABELS[metric] ?? metric}: ${score.toFixed(2)}`}
                  >
                    {score.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
