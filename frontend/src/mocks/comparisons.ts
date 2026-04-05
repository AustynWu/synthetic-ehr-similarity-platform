// ========================================================
// mocks/comparisons.ts — 假的「已儲存比較記錄」
// ========================================================
// 模擬使用者在之前已經做過兩次比較並儲存的情況。
// 這讓 SavedComparisonsPage 一開始就有資料可以顯示，
// 而不是空白的狀態。
// ========================================================

import type { SavedComparison } from "../types/contracts";

export const mockSavedComparisons: SavedComparison[] = [
  // 第一筆：使用三個基本指標做的基準評估
  {
    id: "saved-001",
    runName: "Baseline evaluation - V1 synthetic",
    createdAt: "2026-04-01T11:30:00Z",
    createdAtLabel: "1 Apr 2026",       // 給使用者看的日期（比 ISO 格式好讀）
    realDatasetName: "diabetic_data.csv",
    syntheticDatasetName: "V1_syn.csv",
    overallSimilarityScore: 0.83,       // 83 分
    metricsUsed: ["mean_difference", "ks_test", "chi_square"],
    status: "completed",
  },
  // 第二筆：只針對「結果相關欄位」做的比較，分數略高
  {
    id: "saved-002",
    runName: "Outcome-focused comparison",
    createdAt: "2026-04-01T15:20:00Z",
    createdAtLabel: "1 Apr 2026",
    realDatasetName: "diabetic_data.csv",
    syntheticDatasetName: "V1_syn.csv",
    overallSimilarityScore: 0.86,       // 86 分（聚焦在類別型指標，所以較高）
    metricsUsed: ["chi_square", "category_proportion_difference"],
    status: "completed",
  },
];
