// comparisonService.ts — manages saved comparison runs
//
// Why save comparisons?
//   After a user runs an evaluation and is happy with the result, they can save it.
//   Saved runs appear on the Saved Comparisons page so they can review past results
//   without having to re-upload files and re-run the analysis.
//
// Two modes (controlled by VITE_USE_REAL_API in .env.local):
//   Real API mode: GET /comparisons fetches the list; POST /comparisons/save stores a new run.
//                  Data persists as long as the backend server is running.
//   Mock mode:     Uses a module-level variable (savedRuns) as a simple in-memory list.
//                  Data is lost when the browser tab is refreshed (no real storage).
//
// Mock data is preserved and never deleted — it is always the fallback.

import { mockSavedComparisons } from "../mocks/comparisons";
import type { EvaluationConfig, EvaluationResult, SavedComparison, UploadedDatasets } from "../types/contracts";
import { USE_REAL_API, apiGet, apiPost } from "./apiClient";

// Why let instead of const?
//   savedRuns needs to be replaced (not just mutated) when we prepend a new run.
//   const would prevent reassigning the variable, so we use let.
// Why [...mockSavedComparisons]?
//   The spread makes a shallow copy of the mock array.
//   Without the copy, savedRuns and mockSavedComparisons would point to the same array,
//   and adding to savedRuns would also change the original mock data (which we want to keep intact).
let savedRuns: SavedComparison[] = [...mockSavedComparisons];


// Returns the list of all saved comparison runs.
//
// Why async even for the mock path?
//   The real API path must be async (network call takes time).
//   To keep the function signature the same in both modes, we make both paths async.
//   Promise.resolve(x) wraps a plain value in an already-resolved Promise — no waiting needed.
//
// Real API: GET /comparisons → backend returns its saved list.
// Mock:     Returns the in-memory list immediately.
export async function getSavedComparisons(): Promise<SavedComparison[]> {
  if (USE_REAL_API) {
    return apiGet<SavedComparison[]>("/comparisons");
  }
  return Promise.resolve(savedRuns);
}


// Save the current evaluation run and return the updated full list.
//
// Why does this accept an object with three named fields instead of three positional arguments?
//   Named fields make call sites easier to read. Instead of saveCurrentComparison(a, b, c)
//   (hard to know which is which), the caller writes { evaluationConfig, evaluationResult, uploadedDatasets }
//   which is self-documenting.
//
// Why return the updated list?
//   App.tsx needs the fresh list to update its state so the Saved page re-renders immediately.
//   Instead of making App.tsx call getSavedComparisons() separately, we return it here in one step.
//
// Real API: POST /comparisons/save to store the run, then GET /comparisons for the fresh list.
// Mock:     Build a new record locally and prepend it to the in-memory list.
export async function saveCurrentComparison({
  evaluationConfig,
  evaluationResult,
  uploadedDatasets,
}: {
  evaluationConfig: EvaluationConfig;
  evaluationResult: EvaluationResult;
  uploadedDatasets: UploadedDatasets;
}): Promise<SavedComparison[]> {
  if (USE_REAL_API) {
    // Send only what the backend needs to build a summary record.
    // We do NOT send the full EvaluationResult just for the list — only the score and names.
    await apiPost("/comparisons/save", {
      evaluationResult,
      realDatasetName: uploadedDatasets.realDataset?.fileName ?? "diabetic_data.csv",
      syntheticDatasetName: uploadedDatasets.syntheticDataset?.fileName ?? "V1_syn.csv",
      metricsUsed: evaluationConfig.selectedMetrics,
    });
    // After saving, fetch the full updated list from the backend.
    return apiGet<SavedComparison[]>("/comparisons");
  }

  // --- mock fallback (original behaviour, unchanged) ---
  const now = new Date();

  const newRun: SavedComparison = {
    // Why now.getTime()?
    //   getTime() returns milliseconds since 1970 — always unique, so it works as a simple ID.
    id: `run-${now.getTime()}`,
    runName: `Prototype evaluation - ${uploadedDatasets.syntheticDataset?.fileName ?? "V1_syn.csv"}`,
    createdAt: now.toISOString(),
    createdAtLabel: now.toLocaleDateString(), // locale-formatted date, e.g. "08/04/2026"
    realDatasetName: uploadedDatasets.realDataset?.fileName ?? "diabetic_data.csv",
    syntheticDatasetName: uploadedDatasets.syntheticDataset?.fileName ?? "V1_syn.csv",
    overallSimilarityScore: evaluationResult.summary.overallSimilarityScore,
    metricsUsed: evaluationConfig.selectedMetrics,
    status: "completed",
  };

  // Why [newRun, ...savedRuns] instead of savedRuns.push(newRun)?
  //   push() would mutate the existing array and React might not detect the change.
  //   Creating a new array ([newRun, ...savedRuns]) guarantees a fresh reference,
  //   which triggers React to re-render the page correctly.
  //   newRun is placed first so the newest run appears at the top of the list.
  savedRuns = [newRun, ...savedRuns];
  return savedRuns;
}
