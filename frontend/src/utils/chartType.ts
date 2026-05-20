// chartType.ts — map a variable type to the correct chart rendering style
//
// Rule: numerical → histogram_kde, categorical → grouped_bar
// This matches what the backend provides (coarse "numerical" / "categorical")
// so no special-casing per variable name is needed.

import type { ChartType, VariableType } from "../types/contracts";

export function getChartType(
  _variableName: string,
  variableType: VariableType | string,
): ChartType {
  switch (variableType) {
    case "continuous_numerical":
    case "discrete_numerical":
    case "numerical":
      return "histogram_kde";

    case "categorical":
      return "grouped_bar";

    default:
      return "grouped_bar";
  }
}
