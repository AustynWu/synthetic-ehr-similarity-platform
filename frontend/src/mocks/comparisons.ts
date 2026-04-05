// mocks/comparisons.ts — pre-seeded saved comparison runs
//
// Simulates two runs the user has already saved,
// so SavedComparisonsPage has data to display on first load.

import type { SavedComparison } from "../types/contracts";

export const mockSavedComparisons: SavedComparison[] = [
  // Run 1: baseline evaluation using three basic metrics
  {
    id: "saved-001",
    runName: "Baseline evaluation - V1 synthetic",
    createdAt: "2026-04-01T11:30:00Z",
    createdAtLabel: "1 Apr 2026",
    realDatasetName: "diabetic_data.csv",
    syntheticDatasetName: "V1_syn.csv",
    overallSimilarityScore: 0.83,
    metricsUsed: ["mean_difference", "ks_test", "chi_square"],
    status: "completed",
  },
  // Run 2: outcome-focused comparison — score slightly higher because categorical metrics suit this subset
  {
    id: "saved-002",
    runName: "Outcome-focused comparison",
    createdAt: "2026-04-01T15:20:00Z",
    createdAtLabel: "1 Apr 2026",
    realDatasetName: "diabetic_data.csv",
    syntheticDatasetName: "V1_syn.csv",
    overallSimilarityScore: 0.86,
    metricsUsed: ["chi_square", "category_proportion_difference"],
    status: "completed",
  },
];
