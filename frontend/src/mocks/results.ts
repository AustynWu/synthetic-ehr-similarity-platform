// ========================================================
// mocks/results.ts — mock evaluation result
// ========================================================
// Simulates the JSON a FastAPI backend would return after running
// a similarity evaluation on diabetic_data.csv vs V1_syn.csv.
//
// Selected variables: 8 (numerical + categorical mix)
// Selected metrics: all 6 available metrics
// ========================================================

import type { EvaluationResult } from "../types/contracts";

export const mockEvaluationResult: EvaluationResult = {
  runId: "run-2026-04-05-001",
  generatedAt: "2026-04-05T14:30:00Z",

  // ── Top-level scores (6 summary cards) ──────────────────
  summary: {
    overallSimilarityScore: 0.82,
    numericalSimilarityScore: 0.78,
    categoricalSimilarityScore: 0.87,
    relationshipSimilarityScore: 0.74,
    variablesAnalyzed: 8,
    metricsUsed: 6,
  },

  // ── What the user configured on the Setup page ──────────
  analysisContext: {
    realDatasetName: "diabetic_data.csv",
    syntheticDatasetName: "V1_syn.csv",
    selectedVariables: [
      "gender", "age", "time_in_hospital", "num_medications",
      "num_lab_procedures", "A1Cresult", "insulin", "readmitted",
    ],
    selectedMetrics: [
      "mean_difference", "ks_test", "wasserstein_distance",
      "chi_square", "category_proportion_difference", "correlation_difference",
    ],
  },

  // ── Auto-generated sentences explaining the run ─────────
  reminders: [
    "This comparison used 8 selected variables across numerical and categorical groups.",
    "Numerical variables (time_in_hospital, num_medications, num_lab_procedures) were evaluated with mean difference, KS test, and Wasserstein distance.",
    "Categorical variables were evaluated with chi-square and category proportion difference.",
    "Relationship preservation across all variables was summarised using correlation difference.",
  ],

  // ── Per-variable ranking, sorted by importanceScore desc ─
  variableRanking: [
    { variable: "A1Cresult",          type: "categorical", importanceScore: 0.91, similarityScore: 0.63, status: "poor",     topContributingMetric: "chi_square" },
    { variable: "time_in_hospital",   type: "numerical",   importanceScore: 0.88, similarityScore: 0.72, status: "moderate", topContributingMetric: "ks_test" },
    { variable: "num_medications",    type: "numerical",   importanceScore: 0.84, similarityScore: 0.76, status: "moderate", topContributingMetric: "wasserstein_distance" },
    { variable: "age",                type: "categorical", importanceScore: 0.79, similarityScore: 0.79, status: "moderate", topContributingMetric: "chi_square" },
    { variable: "readmitted",         type: "categorical", importanceScore: 0.74, similarityScore: 0.81, status: "good",     topContributingMetric: "chi_square" },
    { variable: "insulin",            type: "categorical", importanceScore: 0.68, similarityScore: 0.83, status: "good",     topContributingMetric: "category_proportion_difference" },
    { variable: "num_lab_procedures", type: "numerical",   importanceScore: 0.64, similarityScore: 0.85, status: "good",     topContributingMetric: "mean_difference" },
    { variable: "gender",             type: "categorical", importanceScore: 0.52, similarityScore: 0.94, status: "good",     topContributingMetric: "category_proportion_difference" },
  ],

  // ── Variable × Metric matrix (sparse — only applicable pairs) ──
  metricMatrix: {
    variables: [
      "gender", "age", "time_in_hospital", "num_medications",
      "num_lab_procedures", "A1Cresult", "insulin", "readmitted",
    ],
    metrics: [
      "mean_difference", "ks_test", "wasserstein_distance",
      "chi_square", "category_proportion_difference", "correlation_difference",
    ],
    cells: [
      // gender (categorical — only chi_square, cat_prop, correlation)
      { variable: "gender",             metric: "chi_square",                    normalizedScore: 0.91 },
      { variable: "gender",             metric: "category_proportion_difference", normalizedScore: 0.94 },
      { variable: "gender",             metric: "correlation_difference",         normalizedScore: 0.88 },
      // age (categorical)
      { variable: "age",                metric: "chi_square",                    normalizedScore: 0.81 },
      { variable: "age",                metric: "category_proportion_difference", normalizedScore: 0.78 },
      { variable: "age",                metric: "correlation_difference",         normalizedScore: 0.76 },
      // time_in_hospital (numerical — mean_diff, ks, wasserstein, correlation)
      { variable: "time_in_hospital",   metric: "mean_difference",               normalizedScore: 0.75 },
      { variable: "time_in_hospital",   metric: "ks_test",                       normalizedScore: 0.70 },
      { variable: "time_in_hospital",   metric: "wasserstein_distance",          normalizedScore: 0.71 },
      { variable: "time_in_hospital",   metric: "correlation_difference",        normalizedScore: 0.68 },
      // num_medications (numerical)
      { variable: "num_medications",    metric: "mean_difference",               normalizedScore: 0.77 },
      { variable: "num_medications",    metric: "ks_test",                       normalizedScore: 0.74 },
      { variable: "num_medications",    metric: "wasserstein_distance",          normalizedScore: 0.76 },
      { variable: "num_medications",    metric: "correlation_difference",        normalizedScore: 0.72 },
      // num_lab_procedures (numerical)
      { variable: "num_lab_procedures", metric: "mean_difference",               normalizedScore: 0.86 },
      { variable: "num_lab_procedures", metric: "ks_test",                       normalizedScore: 0.84 },
      { variable: "num_lab_procedures", metric: "wasserstein_distance",          normalizedScore: 0.85 },
      { variable: "num_lab_procedures", metric: "correlation_difference",        normalizedScore: 0.82 },
      // A1Cresult (categorical)
      { variable: "A1Cresult",          metric: "chi_square",                    normalizedScore: 0.65 },
      { variable: "A1Cresult",          metric: "category_proportion_difference", normalizedScore: 0.61 },
      { variable: "A1Cresult",          metric: "correlation_difference",        normalizedScore: 0.58 },
      // insulin (categorical)
      { variable: "insulin",            metric: "chi_square",                    normalizedScore: 0.84 },
      { variable: "insulin",            metric: "category_proportion_difference", normalizedScore: 0.82 },
      { variable: "insulin",            metric: "correlation_difference",        normalizedScore: 0.80 },
      // readmitted (categorical)
      { variable: "readmitted",         metric: "chi_square",                    normalizedScore: 0.81 },
      { variable: "readmitted",         metric: "category_proportion_difference", normalizedScore: 0.79 },
      { variable: "readmitted",         metric: "correlation_difference",        normalizedScore: 0.76 },
    ],
  },

  // ── Detail views for selected variables ─────────────────
  // Backend decides which variables get a detail view.
  // Frontend renders whatever is in this record.
  detailViews: {
    readmitted: {
      chartType: "groupedBar",
      title: "Readmission distribution: real vs synthetic",
      series: [
        { label: "NO",  real: 0.54, synthetic: 0.51 },
        { label: ">30", real: 0.35, synthetic: 0.37 },
        { label: "<30", real: 0.11, synthetic: 0.12 },
      ],
      metrics: [
        { name: "chi_square",                    value: 0.12, normalizedScore: 0.81 },
        { name: "category_proportion_difference", value: 0.05, normalizedScore: 0.79 },
      ],
    },
    time_in_hospital: {
      chartType: "distributionComparison",
      title: "Time in hospital distribution: real vs synthetic",
      series: [
        { label: "1-3 days", real: 0.33, synthetic: 0.30 },
        { label: "4-6 days", real: 0.42, synthetic: 0.45 },
        { label: "7-9 days", real: 0.17, synthetic: 0.18 },
        { label: "10+ days", real: 0.08, synthetic: 0.07 },
      ],
      metrics: [
        { name: "mean_difference",      value: 0.34, normalizedScore: 0.75 },
        { name: "ks_test",              value: 0.21, normalizedScore: 0.70 },
        { name: "wasserstein_distance", value: 0.41, normalizedScore: 0.71 },
      ],
    },
    A1Cresult: {
      chartType: "groupedBar",
      title: "A1C result distribution: real vs synthetic",
      series: [
        { label: "None", real: 0.83, synthetic: 0.78 },
        { label: "Norm", real: 0.09, synthetic: 0.12 },
        { label: ">7",   real: 0.05, synthetic: 0.06 },
        { label: ">8",   real: 0.03, synthetic: 0.04 },
      ],
      metrics: [
        { name: "chi_square",                    value: 0.31, normalizedScore: 0.65 },
        { name: "category_proportion_difference", value: 0.09, normalizedScore: 0.61 },
      ],
    },
  },

  // ── Auto-generated observations ──────────────────────────
  insights: [
    "Most demographic and medication-related variables show moderate to strong similarity.",
    "A1Cresult has the lowest similarity score (0.63), likely due to high missingness in the real dataset.",
    "The readmission outcome distribution remains broadly aligned — differences are within 3 percentage points.",
  ],
};
