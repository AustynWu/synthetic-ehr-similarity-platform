// evaluationService.ts — evaluation logic service layer
//
// Two responsibilities:
//   1. Provide the list of available statistical metrics (used by Setup page)
//   2. Simulate "run evaluation" and return a result (used by Results page)
//
// Production version: POST the user's config to FastAPI; Python (scipy/pandas) runs the stats.
// Current version:    Return mock results directly, with the user's config attached.

import { mockEvaluationResult } from "../mocks/results";
import type { EvaluationConfig, EvaluationResult, MetricDefinition } from "../types/contracts";

// All available statistical metrics.
// Used both in Setup page (to show options) and in Results page (to map keys to labels).
export const availableMetrics: MetricDefinition[] = [
  {
    key: "mean_difference",
    label: "Mean Difference",
    description: "Compares numerical averages for variables such as time_in_hospital and num_medications.",
    appliesTo: "numerical",
  },
  {
    key: "ks_test",
    label: "KS Test",
    description: "Measures numerical distribution similarity for utilisation and count fields.",
    appliesTo: "numerical",
  },
  {
    key: "wasserstein_distance",
    label: "Wasserstein Distance",
    description: "Estimates distribution gaps for numerical diabetes variables.",
    appliesTo: "numerical",
  },
  {
    key: "chi_square",
    label: "Chi-square Test",
    description: "Compares categorical distributions such as readmitted, gender, and diabetesMed.",
    appliesTo: "categorical",
  },
  {
    key: "category_proportion_difference",
    label: "Category Proportion Difference",
    description: "Summarises how close category proportions are between real and synthetic datasets.",
    appliesTo: "categorical",
  },
  {
    key: "correlation_difference",
    label: "Correlation Difference",
    description: "Represents a simplified relationship-preservation view for later multivariate analysis.",
    appliesTo: "multivariate",
  },
  {
    // Checks whether a numerical variable's distribution across category groups is preserved.
    // Example: time_in_hospital grouped by readmitted — compares real vs synthetic group distributions.
    // Backend uses Kruskal-Wallis (non-parametric, makes no distribution assumption).
    key: "numerical_categorical_association",
    label: "Numerical–Categorical Association",
    description: "Compares how a numerical variable's distribution shifts across categories (e.g., time_in_hospital by readmitted) between real and synthetic data.",
    appliesTo: "cross_type",
  },
];

// Returns the default evaluation config shown when the user first opens the Setup page
export function getDefaultEvaluationConfig(): EvaluationConfig {
  return {
    selectedMetrics: ["mean_difference", "ks_test", "chi_square"], // three defaults pre-checked
    selectedColumns: [],        // empty — Setup page handles the initial selection
    // Backend parameters not exposed in the UI; backend uses these defaults directly
    includeNumerical: true,
    includeCategorical: true,
    missingValueHandling: "ignore",
    significanceLevel: 0.05,
  };
}

// Simulates "run evaluation".
// Production: POST to FastAPI with config, await results.
// Current:    Returns mock data with the user's config attached for completeness.
export async function runEvaluation(config: EvaluationConfig): Promise<EvaluationResult> {
  return Promise.resolve({
    ...mockEvaluationResult,
    appliedConfig: config,
  });
}
