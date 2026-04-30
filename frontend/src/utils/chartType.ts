// chartType.ts — map a variable type to the correct chart rendering style
//
// Rule: numerical → histogram_kde, categorical → grouped_bar
// This matches what the backend provides (coarse "numerical" / "categorical")
// so no special-casing per variable name is needed.

import type { ChartType, VariableType } from "../types/contracts";

export function getChartType(
  _variableName: string,
  variableType: VariableType | string,
  analysisType?: string
): ChartType {
  // Multivariate analysis type takes priority
  if (analysisType === "numerical-numerical") return "correlation_heatmap";
  if (analysisType === "mixed")               return "grouped_boxplot";

  switch (variableType) {
    case "continuous_numerical":
    case "discrete_numerical":
    case "numerical":
      return "histogram_kde";

    case "categorical":
      return "grouped_bar";

    default:
      return "summary_table";
  }
}
