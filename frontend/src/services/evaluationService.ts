// evaluationService.ts — evaluation logic service layer
//
// Two responsibilities:
//   1. Hold the list of available statistical metrics (used by the Setup page to show checkboxes)
//   2. Run the evaluation and return similarity results (used by the Results page)
//
// Two modes (controlled by VITE_USE_REAL_API in .env.local):
//   Real API mode: POST /evaluations/run sends dataset IDs + user config to the backend,
//                  which runs the actual pandas/scipy calculations and returns real scores.
//   Mock mode:     Returns the pre-written mock result directly; no backend needed.
//
// Mock data is preserved and never deleted — it is always the fallback.

import { mockEvaluationResult } from "../mocks/results";
import type { EvaluationConfig, EvaluationResult, MetricDefinition } from "../types/contracts";
import { USE_REAL_API, apiGet, apiPost } from "./apiClient";


// The full list of supported statistical metrics.
// Each entry has:
//   key         — the machine-readable ID sent to the backend
//   label       — the human-readable name shown in the UI
//   description — one sentence explaining what the metric measures
//   appliesTo   — which column type this metric works on
//
// Why keep this list here instead of only fetching from backend?
//   The Setup page needs the list immediately when it loads.
//   If we only fetch from the backend, there would be a loading delay and
//   the page would break when the backend is offline.
//   Having a local copy as fallback keeps the UI always usable.
export const availableMetrics: MetricDefinition[] = [

  // ── Univariate > Numerical ──────────────────────────────────────────────────

  {
    key: "mean_difference",
    label: "Mean Difference",
    description: "Compares the average value of a numerical variable between real and synthetic data.",
    appliesTo: "numerical",
    group: "Univariate",
    subgroup: "Numerical",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical"],
    priority: "Core",
    implemented: true,
  },
  {
    key: "ks_test",
    label: "KS Test",
    description: "Measures how different two numerical distributions are by comparing their cumulative curves.",
    appliesTo: "numerical",
    group: "Univariate",
    subgroup: "Numerical",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical"],
    priority: "Core",
    implemented: true,
  },
  {
    key: "wasserstein_distance",
    label: "Wasserstein Distance",
    description: "Estimates how much the synthetic distribution would need to shift to match the real one.",
    appliesTo: "numerical",
    group: "Univariate",
    subgroup: "Numerical",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical"],
    priority: "Recommended",
    implemented: true,
  },
  {
    key: "median_difference",
    label: "Median Difference",
    description: "Compares the median value, which is less sensitive to extreme values than the mean.",
    appliesTo: "numerical",
    group: "Univariate",
    subgroup: "Numerical",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical"],
    priority: "Recommended",
    implemented: false,
  },
  {
    key: "std_difference",
    label: "Standard Deviation Difference",
    description: "Checks whether the spread of values is similar between real and synthetic data.",
    appliesTo: "numerical",
    group: "Univariate",
    subgroup: "Numerical",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical"],
    priority: "Recommended",
    implemented: false,
  },
  {
    key: "iqr_difference",
    label: "IQR Difference",
    description: "Compares the interquartile range, which shows how spread out the middle 50% of values are.",
    appliesTo: "numerical",
    group: "Univariate",
    subgroup: "Numerical",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical"],
    priority: "Optional",
    implemented: false,
  },

  // ── Univariate > Categorical ────────────────────────────────────────────────

  {
    key: "chi_square",
    label: "Chi-square Test",
    description: "Tests whether the category frequency pattern is statistically different between real and synthetic.",
    appliesTo: "categorical",
    group: "Univariate",
    subgroup: "Categorical",
    applicableVariableTypes: ["categorical"],
    priority: "Core",
    implemented: true,
  },
  {
    key: "category_proportion_difference",
    label: "Category Proportion Difference",
    description: "Directly compares what percentage of rows fall into each category in real vs synthetic.",
    appliesTo: "categorical",
    group: "Univariate",
    subgroup: "Categorical",
    applicableVariableTypes: ["categorical"],
    priority: "Core",
    implemented: true,
  },
  {
    key: "unseen_category_check",
    label: "Unseen / Invalid Category Check",
    description: "Flags any categories in the synthetic data that never appear in the real data.",
    appliesTo: "categorical",
    group: "Univariate",
    subgroup: "Categorical",
    applicableVariableTypes: ["categorical"],
    priority: "Recommended",
    implemented: false,
  },
  {
    key: "total_variation_distance",
    label: "Total Variation Distance",
    description: "Sums the absolute differences in category proportions to give one overall distance score.",
    appliesTo: "categorical",
    group: "Univariate",
    subgroup: "Categorical",
    applicableVariableTypes: ["categorical"],
    priority: "Optional",
    implemented: false,
  },

  // ── Multivariate > Numerical–Numerical ─────────────────────────────────────

  {
    key: "correlation_difference",
    label: "Pearson Correlation Comparison",
    description: "Checks whether the linear relationships between numerical variables are preserved in the synthetic data.",
    appliesTo: "multivariate",
    group: "Multivariate",
    subgroup: "Numerical–Numerical",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical"],
    priority: "Recommended",
    implemented: true,
  },
  {
    key: "correlation_matrix_distance",
    label: "Correlation Matrix Distance",
    description: "Measures the overall difference between the full correlation matrices of real and synthetic data.",
    appliesTo: "multivariate",
    group: "Multivariate",
    subgroup: "Numerical–Numerical",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical"],
    priority: "Optional",
    implemented: false,
  },
  {
    key: "spearman_correlation",
    label: "Spearman Correlation Comparison",
    description: "A rank-based version of correlation comparison, less sensitive to outliers.",
    appliesTo: "multivariate",
    group: "Multivariate",
    subgroup: "Numerical–Numerical",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical"],
    priority: "Optional",
    implemented: false,
  },

  // ── Multivariate > Categorical–Categorical ──────────────────────────────────

  {
    key: "cramers_v_comparison",
    label: "Cramér's V Comparison",
    description: "Measures the strength of association between two categorical variables and compares it across real and synthetic.",
    appliesTo: "multivariate",
    group: "Multivariate",
    subgroup: "Categorical–Categorical",
    applicableVariableTypes: ["categorical"],
    priority: "Core",
    implemented: true,
  },
  {
    key: "joint_distribution_comparison",
    label: "Joint Distribution Comparison",
    description: "Compares how often two categorical variables appear together in real vs synthetic data.",
    appliesTo: "multivariate",
    group: "Multivariate",
    subgroup: "Categorical–Categorical",
    applicableVariableTypes: ["categorical"],
    priority: "Optional",
    implemented: false,
  },

  // ── Multivariate > Mixed ────────────────────────────────────────────────────

  {
    key: "numerical_categorical_association",
    label: "Group-wise Summary Comparison",
    description: "Compares the distribution of a numerical variable across category groups between real and synthetic data.",
    appliesTo: "cross_type",
    group: "Multivariate",
    subgroup: "Mixed",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical", "categorical"],
    priority: "Recommended",
    implemented: true,
  },
  {
    key: "correlation_ratio_eta",
    label: "Correlation Ratio (Eta)",
    description: "Measures how much of the variation in a numerical variable is explained by a categorical variable.",
    appliesTo: "cross_type",
    group: "Multivariate",
    subgroup: "Mixed",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical", "categorical"],
    priority: "Optional",
    implemented: false,
  },
  {
    key: "mutual_information",
    label: "Mutual Information",
    description: "Measures the shared information between two variables regardless of their type.",
    appliesTo: "cross_type",
    group: "Multivariate",
    subgroup: "Mixed",
    applicableVariableTypes: ["continuous_numerical", "discrete_numerical", "categorical"],
    priority: "Optional",
    implemented: false,
  },
];


// Returns the default settings shown when the user first opens the Setup page.
// These are sensible starting choices — the user can change them before running.
export function getDefaultEvaluationConfig(): EvaluationConfig {
  return {
    selectedMetrics: ["mean_difference", "ks_test", "chi_square"],
    selectedColumns: [],
    includeNumerical: true,
    includeCategorical: true,
    missingValueHandling: "ignore",
    significanceLevel: 0.05,
    columnTypeOverrides: {},   // empty = use backend inference for all columns
  };
}


// Fetch the metric list from the backend (GET /metrics).
// Why have this if we already have availableMetrics above?
//   In the future the backend may support more metrics than the frontend knows about.
//   This function lets the backend be the single source of truth for the metric list.
//   If the backend call fails, we fall back to the local list so the UI still works.
export async function fetchAvailableMetrics(): Promise<MetricDefinition[]> {
  if (USE_REAL_API) {
    try {
      return await apiGet<MetricDefinition[]>("/metrics");
    } catch {
      // Why catch the error here instead of letting it bubble up?
      //   A failed metrics fetch is not critical — the local list is a perfectly good substitute.
      //   We swallow the error and return the fallback so the page does not crash.
      return availableMetrics;
    }
  }
  return Promise.resolve(availableMetrics);
}


// Run the evaluation: send the user's chosen columns and metrics to the backend,
// which calculates similarity scores and returns the full result.
//
// Why does this function need datasetIds?
//   The backend needs to know which uploaded files to analyse.
//   The IDs come from the upload step (POST /datasets/upload returned them).
//   App.tsx holds those IDs in state and passes them here when calling this function.
//
// Why is datasetIds optional (the ? after the parameter name)?
//   In mock mode there is no upload step and no real IDs.
//   Making it optional means mock-mode code does not need to change.
//   The function only uses IDs when USE_REAL_API is true AND IDs are provided.
//
// Real API: POST /evaluations/run → backend runs pandas/scipy calculations.
// Mock:     Returns a copy of the mock result with the user's actual config attached.
export async function runEvaluation(
  config: EvaluationConfig,
  datasetIds?: { realDatasetId: string; syntheticDatasetId: string }
): Promise<EvaluationResult> {
  if (USE_REAL_API && datasetIds) {
    // Send everything the backend needs in one JSON body:
    //   realDatasetId + syntheticDatasetId — which files to load
    //   config                             — which columns and metrics to use
    return apiPost<EvaluationResult>("/evaluations/run", {
      realDatasetId: datasetIds.realDatasetId,
      syntheticDatasetId: datasetIds.syntheticDatasetId,
      config,
    });
  }

  // --- mock fallback (original behaviour, unchanged) ---
  // Why spread (...mockEvaluationResult)?
  //   We want to attach the user's actual config (which columns they selected)
  //   to the mock result for display purposes, without changing any other mock fields.
  return Promise.resolve({
    ...mockEvaluationResult,
    appliedConfig: config,
  });
}
