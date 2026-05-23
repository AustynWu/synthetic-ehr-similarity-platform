// ========================================================
// MetricHeatmap.tsx — variable × metric raw value table
// ========================================================
// Renders a grid where:
//   rows    = variables (from metricMatrix.variables)
//   columns = metrics  (from metricMatrix.metrics)
//   cell    = rawValue (original metric value, not normalised)
//   empty   = metric does not apply to this variable type
//
// correlation_difference is hidden per supervisor instruction:
// it is a cross-variable metric and does not belong in per-variable table.
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

// Correlation is a cross-variable metric — hidden per supervisor instruction
const HIDDEN_METRICS = new Set(["correlation_difference"]);

export default function MetricHeatmap({ matrix }: { matrix: MetricMatrix }) {
  // Build a fast lookup: "variable__metric" → rawValue (null/undefined for old records → shows "—")
  const lookup = new Map(
    matrix.cells.map((c) => [`${c.variable}__${c.metric}`, c.rawValue ?? null])
  );

  const visibleMetrics = matrix.metrics.filter((m) => !HIDDEN_METRICS.has(m));

  return (
    <div className="heatmap-scroll-wrapper">
      <table className="heatmap-table">
        <thead>
          <tr>
            <th className="heatmap-corner" />
            {visibleMetrics.map((metric) => (
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
              {visibleMetrics.map((metric) => {
                const raw = lookup.get(`${variable}__${metric}`);
                if (raw == null) {
                  return <td key={metric} className="heatmap-cell na">—</td>;
                }
                return (
                  <td
                    key={metric}
                    className="heatmap-cell"
                    title={`${getVariableDisplayName(variable)} × ${SHORT_LABELS[metric] ?? metric}: ${raw.toFixed(4)}`}
                  >
                    {raw.toFixed(4)}
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
