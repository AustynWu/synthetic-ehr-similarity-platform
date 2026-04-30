// ========================================================
// mocks/results.ts — mock evaluation result
// ========================================================
// All distribution proportions are computed from the actual datasets:
//   Real:      diabetic_data.csv
//   Synthetic: V1_syn.csv
//
// Notable finding: A1Cresult shows a major divergence —
//   real data has 83% "None" (test not taken), synthetic has 0%.
//   This is reflected in the low similarity score for that variable.
// ========================================================

import type { EvaluationResult } from "../types/contracts";

export const mockEvaluationResult: EvaluationResult = {
  runId: "run-2026-04-05-001",
  generatedAt: "2026-04-05T14:30:00Z",

  summary: {
    overallSimilarityScore:      0.82,
    numericalSimilarityScore:    0.91,
    categoricalSimilarityScore:  0.72,
    relationshipSimilarityScore: 0.79,
    variablesAnalyzed: 8,
    metricsUsed: 6,
  },

  analysisContext: {
    realDatasetName:      "diabetic_data.csv",
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

  reminders: [
    "8 variables analysed across numerical and categorical groups.",
    "Numerical variables evaluated with mean difference, KS test, and Wasserstein distance.",
    "Categorical variables evaluated with chi-square and category proportion difference.",
    "A1Cresult shows a critical divergence: the synthetic dataset contains no 'None' values, whereas 83% of real patients did not take the A1C test.",
  ],

  // Sorted by similarityScore ascending in the UI (lowest first = most divergent first)
  variableRanking: [
    { variable: "A1Cresult",          type: "categorical", importanceScore: 0.91, similarityScore: 0.12, status: "poor",     topContributingMetric: "chi_square" },
    { variable: "time_in_hospital",   type: "numerical",   importanceScore: 0.88, similarityScore: 0.87, status: "good",     topContributingMetric: "ks_test" },
    { variable: "insulin",            type: "categorical", importanceScore: 0.68, similarityScore: 0.88, status: "good",     topContributingMetric: "category_proportion_difference" },
    { variable: "num_medications",    type: "numerical",   importanceScore: 0.84, similarityScore: 0.90, status: "good",     topContributingMetric: "mean_difference" },
    { variable: "readmitted",         type: "categorical", importanceScore: 0.74, similarityScore: 0.92, status: "good",     topContributingMetric: "chi_square" },
    { variable: "num_lab_procedures", type: "numerical",   importanceScore: 0.64, similarityScore: 0.93, status: "good",     topContributingMetric: "mean_difference" },
    { variable: "age",                type: "numerical",   importanceScore: 0.79, similarityScore: 0.96, status: "good",     topContributingMetric: "ks_test" },
    { variable: "gender",             type: "categorical", importanceScore: 0.52, similarityScore: 0.97, status: "good",     topContributingMetric: "category_proportion_difference" },
  ],

  metricMatrix: {
    variables: [
      "A1Cresult", "time_in_hospital", "insulin", "num_medications",
      "readmitted", "num_lab_procedures", "age", "gender",
    ],
    metrics: [
      "mean_difference", "ks_test", "wasserstein_distance",
      "chi_square", "category_proportion_difference", "correlation_difference",
    ],
    cells: [
      // A1Cresult — massive distribution divergence
      { variable: "A1Cresult", metric: "chi_square",                    normalizedScore: 0.03 },
      { variable: "A1Cresult", metric: "category_proportion_difference", normalizedScore: 0.02 },
      { variable: "A1Cresult", metric: "correlation_difference",         normalizedScore: 0.12 },
      // time_in_hospital
      { variable: "time_in_hospital", metric: "mean_difference",         normalizedScore: 0.88 },
      { variable: "time_in_hospital", metric: "ks_test",                 normalizedScore: 0.86 },
      { variable: "time_in_hospital", metric: "wasserstein_distance",    normalizedScore: 0.87 },
      { variable: "time_in_hospital", metric: "correlation_difference",  normalizedScore: 0.85 },
      // insulin
      { variable: "insulin", metric: "chi_square",                       normalizedScore: 0.89 },
      { variable: "insulin", metric: "category_proportion_difference",   normalizedScore: 0.87 },
      { variable: "insulin", metric: "correlation_difference",           normalizedScore: 0.86 },
      // num_medications
      { variable: "num_medications", metric: "mean_difference",          normalizedScore: 0.92 },
      { variable: "num_medications", metric: "ks_test",                  normalizedScore: 0.90 },
      { variable: "num_medications", metric: "wasserstein_distance",     normalizedScore: 0.91 },
      { variable: "num_medications", metric: "correlation_difference",   normalizedScore: 0.88 },
      // readmitted
      { variable: "readmitted", metric: "chi_square",                    normalizedScore: 0.93 },
      { variable: "readmitted", metric: "category_proportion_difference", normalizedScore: 0.92 },
      { variable: "readmitted", metric: "correlation_difference",         normalizedScore: 0.91 },
      // num_lab_procedures
      { variable: "num_lab_procedures", metric: "mean_difference",       normalizedScore: 0.94 },
      { variable: "num_lab_procedures", metric: "ks_test",               normalizedScore: 0.93 },
      { variable: "num_lab_procedures", metric: "wasserstein_distance",  normalizedScore: 0.93 },
      { variable: "num_lab_procedures", metric: "correlation_difference", normalizedScore: 0.91 },
      // age
      { variable: "age", metric: "chi_square",                           normalizedScore: 0.97 },
      { variable: "age", metric: "category_proportion_difference",       normalizedScore: 0.96 },
      { variable: "age", metric: "correlation_difference",               normalizedScore: 0.95 },
      // gender
      { variable: "gender", metric: "chi_square",                        normalizedScore: 0.98 },
      { variable: "gender", metric: "category_proportion_difference",    normalizedScore: 0.97 },
      { variable: "gender", metric: "correlation_difference",            normalizedScore: 0.96 },
    ],
  },

  detailViews: {

    // A1Cresult — critical divergence: real has 83% None, synthetic has 0%
    A1Cresult: {
      chartType: "grouped_bar",
      title: "A1C Result Distribution: Real vs Synthetic",
      xAxisLabel: "A1C Result",
      yAxisLabel: "Proportion of patients",
      series: [
        { label: "None", real: 0.833, synthetic: 0.000 },
        { label: "Norm", real: 0.049, synthetic: 0.292 },
        { label: ">7",   real: 0.037, synthetic: 0.222 },
        { label: ">8",   real: 0.081, synthetic: 0.486 },
      ],
      metrics: [
        { name: "chi_square",                    value: 48.3, normalizedScore: 0.03 },
        { name: "category_proportion_difference", value: 0.83, normalizedScore: 0.02 },
      ],
    },

    // time_in_hospital — discrete days 1–11+, shown as histogram like other numerical variables
    time_in_hospital: {
      chartType: "histogram_kde",
      title: "Time in Hospital Distribution: Real vs Synthetic",
      xAxisLabel: "Number of days in hospital",
      yAxisLabel: "Proportion of patients",
      series: [
        { label: "1",   real: 0.140, synthetic: 0.138 },
        { label: "2",   real: 0.169, synthetic: 0.169 },
        { label: "3",   real: 0.174, synthetic: 0.173 },
        { label: "4",   real: 0.137, synthetic: 0.136 },
        { label: "5",   real: 0.098, synthetic: 0.098 },
        { label: "6",   real: 0.074, synthetic: 0.075 },
        { label: "7",   real: 0.058, synthetic: 0.058 },
        { label: "8",   real: 0.043, synthetic: 0.044 },
        { label: "9",   real: 0.029, synthetic: 0.030 },
        { label: "10",  real: 0.023, synthetic: 0.023 },
        { label: "11+", real: 0.055, synthetic: 0.056 },
      ],
      metrics: [
        { name: "mean_difference",      value: 0.08, normalizedScore: 0.88 },
        { name: "ks_test",              value: 0.11, normalizedScore: 0.86 },
        { name: "wasserstein_distance", value: 0.09, normalizedScore: 0.87 },
      ],
    },

    // insulin — categorical
    insulin: {
      chartType: "grouped_bar",
      title: "Insulin Usage Distribution: Real vs Synthetic",
      xAxisLabel: "Insulin dosage",
      yAxisLabel: "Proportion of patients",
      series: [
        { label: "No",     real: 0.466, synthetic: 0.482 },
        { label: "Steady", real: 0.303, synthetic: 0.291 },
        { label: "Down",   real: 0.120, synthetic: 0.118 },
        { label: "Up",     real: 0.111, synthetic: 0.108 },
      ],
      metrics: [
        { name: "chi_square",                    value: 0.21, normalizedScore: 0.89 },
        { name: "category_proportion_difference", value: 0.03, normalizedScore: 0.87 },
      ],
    },

    // num_medications — continuous distribution
    num_medications: {
      chartType: "histogram_kde",
      title: "Distribution of Number of Medications: Real vs Synthetic",
      xAxisLabel: "Number of medications",
      yAxisLabel: "Proportion of patients",
      series: [
        { label: "0–5",   real: 0.030, synthetic: 0.029 },
        { label: "5–10",  real: 0.172, synthetic: 0.171 },
        { label: "10–15", real: 0.284, synthetic: 0.283 },
        { label: "15–20", real: 0.243, synthetic: 0.244 },
        { label: "20–25", real: 0.141, synthetic: 0.141 },
        { label: "25–30", real: 0.070, synthetic: 0.071 },
        { label: "30–40", real: 0.045, synthetic: 0.044 },
        { label: "40+",   real: 0.015, synthetic: 0.016 },
      ],
      metrics: [
        { name: "mean_difference",      value: 0.10, normalizedScore: 0.92 },
        { name: "ks_test",              value: 0.08, normalizedScore: 0.90 },
        { name: "wasserstein_distance", value: 0.11, normalizedScore: 0.91 },
      ],
    },

    // readmitted
    readmitted: {
      chartType: "grouped_bar",
      title: "Readmission Status Distribution: Real vs Synthetic",
      xAxisLabel: "Readmission status",
      yAxisLabel: "Proportion of patients",
      series: [
        { label: "NO",  real: 0.539, synthetic: 0.538 },
        { label: ">30", real: 0.349, synthetic: 0.348 },
        { label: "<30", real: 0.112, synthetic: 0.113 },
      ],
      metrics: [
        { name: "chi_square",                    value: 0.09, normalizedScore: 0.93 },
        { name: "category_proportion_difference", value: 0.01, normalizedScore: 0.92 },
      ],
    },

    // num_lab_procedures — continuous distribution
    num_lab_procedures: {
      chartType: "histogram_kde",
      title: "Distribution of Number of Lab Procedures: Real vs Synthetic",
      xAxisLabel: "Number of lab procedures",
      yAxisLabel: "Proportion of patients",
      series: [
        { label: "0–10",  real: 0.074, synthetic: 0.073 },
        { label: "10–20", real: 0.061, synthetic: 0.062 },
        { label: "20–30", real: 0.089, synthetic: 0.088 },
        { label: "30–40", real: 0.169, synthetic: 0.169 },
        { label: "40–50", real: 0.221, synthetic: 0.223 },
        { label: "50–60", real: 0.178, synthetic: 0.179 },
        { label: "60–70", real: 0.128, synthetic: 0.129 },
        { label: "70+",   real: 0.078, synthetic: 0.078 },
      ],
      metrics: [
        { name: "mean_difference",      value: 0.07, normalizedScore: 0.94 },
        { name: "ks_test",              value: 0.06, normalizedScore: 0.93 },
        { name: "wasserstein_distance", value: 0.08, normalizedScore: 0.93 },
      ],
    },

    // age — age group bins from original dataset
    age: {
      chartType: "histogram_kde",
      title: "Distribution of Age: Real vs Synthetic",
      xAxisLabel: "Age group",
      yAxisLabel: "Proportion of patients",
      series: [
        { label: "[0-10)",   real: 0.002, synthetic: 0.002 },
        { label: "[10-20)",  real: 0.007, synthetic: 0.007 },
        { label: "[20-30)",  real: 0.016, synthetic: 0.016 },
        { label: "[30-40)",  real: 0.037, synthetic: 0.037 },
        { label: "[40-50)",  real: 0.095, synthetic: 0.095 },
        { label: "[50-60)",  real: 0.170, synthetic: 0.168 },
        { label: "[60-70)",  real: 0.221, synthetic: 0.220 },
        { label: "[70-80)",  real: 0.256, synthetic: 0.256 },
        { label: "[80-90)",  real: 0.169, synthetic: 0.171 },
        { label: "[90-100)", real: 0.027, synthetic: 0.027 },
      ],
      metrics: [
        { name: "chi_square",                    value: 0.05, normalizedScore: 0.97 },
        { name: "category_proportion_difference", value: 0.01, normalizedScore: 0.96 },
      ],
    },

    // gender
    gender: {
      chartType: "grouped_bar",
      title: "Gender Distribution: Real vs Synthetic",
      xAxisLabel: "Gender",
      yAxisLabel: "Proportion of patients",
      series: [
        { label: "Female", real: 0.538, synthetic: 0.536 },
        { label: "Male",   real: 0.462, synthetic: 0.464 },
      ],
      metrics: [
        { name: "chi_square",                    value: 0.04, normalizedScore: 0.98 },
        { name: "category_proportion_difference", value: 0.01, normalizedScore: 0.97 },
      ],
    },
  },

  insights: [
    "A1Cresult shows a critical divergence: 83% of real patients have no A1C test recorded (None), but this category is absent in the synthetic dataset. This likely indicates a data generation issue.",
    "7 out of 8 variables show good similarity (≥0.85), suggesting the synthetic dataset broadly preserves the real data distribution.",
    "Numerical variables (time_in_hospital, num_medications, num_lab_procedures, age) are closely matched with similarity scores above 0.87.",
  ],

  multivariateResults: {

    // Numerical–Numerical: Pearson r for each pair, sorted by |difference| desc
    topCorrelationPairs: [
      { variable1: "time_in_hospital",   variable2: "num_lab_procedures", realCorrelation: 0.18, syntheticCorrelation: 0.21, difference: 0.03 },
      { variable1: "time_in_hospital",   variable2: "num_medications",    realCorrelation: 0.31, syntheticCorrelation: 0.29, difference: 0.02 },
      { variable1: "num_lab_procedures", variable2: "num_medications",    realCorrelation: 0.24, syntheticCorrelation: 0.22, difference: 0.02 },
      { variable1: "num_medications",    variable2: "age",                realCorrelation: 0.22, syntheticCorrelation: 0.21, difference: 0.01 },
      { variable1: "time_in_hospital",   variable2: "age",                realCorrelation: 0.12, syntheticCorrelation: 0.13, difference: 0.01 },
    ],

    // Categorical–Categorical: Cramér's V for each pair, sorted by |difference| desc
    topCramersVPairs: [
      { variable1: "A1Cresult", variable2: "insulin",    realCramersV: 0.41, syntheticCramersV: 0.38, difference: 0.03 },
      { variable1: "A1Cresult", variable2: "readmitted", realCramersV: 0.19, syntheticCramersV: 0.17, difference: 0.02 },
      { variable1: "readmitted", variable2: "insulin",   realCramersV: 0.12, syntheticCramersV: 0.14, difference: 0.02 },
      { variable1: "gender",    variable2: "readmitted", realCramersV: 0.08, syntheticCramersV: 0.07, difference: 0.01 },
      { variable1: "insulin",   variable2: "gender",     realCramersV: 0.06, syntheticCramersV: 0.07, difference: 0.01 },
    ],

    // Mixed: mean of numerical variable per category group, sorted by |difference| desc
    topGroupwiseRows: [
      { numericalVariable: "num_lab_procedures", categoricalVariable: "A1Cresult",  groupValue: ">8",    realMean: 47.3, syntheticMean: 46.8, difference: 0.5 },
      { numericalVariable: "num_medications",    categoricalVariable: "gender",      groupValue: "Female",realMean: 15.8, syntheticMean: 15.4, difference: 0.4 },
      { numericalVariable: "num_medications",    categoricalVariable: "insulin",     groupValue: "No",    realMean: 14.2, syntheticMean: 14.5, difference: 0.3 },
      { numericalVariable: "time_in_hospital",   categoricalVariable: "readmitted",  groupValue: ">30",   realMean: 5.2,  syntheticMean: 5.0,  difference: 0.2 },
      { numericalVariable: "time_in_hospital",   categoricalVariable: "readmitted",  groupValue: "NO",    realMean: 4.1,  syntheticMean: 4.3,  difference: 0.2 },
    ],

  },
};
