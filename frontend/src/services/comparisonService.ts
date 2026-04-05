// comparisonService.ts — manages saved comparison runs
//
// Handles two operations:
//   - Read the current list of saved runs
//   - Append a new run to the list
//
// Storage: module-level variable (savedRuns)
//   Pro: simple, no backend required
//   Con: data is lost on page refresh
// Future: replace with localStorage or a backend API call

import { mockSavedComparisons } from "../mocks/comparisons";
import type { EvaluationConfig, EvaluationResult, SavedComparison, UploadedDatasets } from "../types/contracts";

// Acts as an in-memory store; initialised with a shallow copy of mock data
let savedRuns: SavedComparison[] = [...mockSavedComparisons];

// Returns the current list of saved runs
export function getSavedComparisons(): SavedComparison[] {
  return savedRuns;
}

// Prepends a new run to the list and returns the updated list.
// Uses object destructuring so callers don't need to remember argument order.
export function saveCurrentComparison({
  evaluationConfig,
  evaluationResult,
  uploadedDatasets,
}: {
  evaluationConfig: EvaluationConfig;
  evaluationResult: EvaluationResult;
  uploadedDatasets: UploadedDatasets;
}): SavedComparison[] {
  const now = new Date();

  const newRun: SavedComparison = {
    id: `run-${now.getTime()}`,  // timestamp in ms gives a unique ID
    runName: `Prototype evaluation - ${uploadedDatasets.syntheticDataset?.fileName ?? "V1_syn.csv"}`,
    createdAt: now.toISOString(),
    createdAtLabel: now.toLocaleDateString(), // locale-formatted date for display
    realDatasetName: uploadedDatasets.realDataset?.fileName ?? "diabetic_data.csv",
    syntheticDatasetName: uploadedDatasets.syntheticDataset?.fileName ?? "V1_syn.csv",
    overallSimilarityScore: evaluationResult.summary.overallSimilarityScore,
    metricsUsed: evaluationConfig.selectedMetrics,
    status: "completed",
  };

  // Newest run first
  savedRuns = [newRun, ...savedRuns];
  return savedRuns;
}
