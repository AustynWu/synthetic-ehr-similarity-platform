// ========================================================
// comparisonService.ts — 儲存比較記錄的「服務層」
// ========================================================
// 負責管理「已儲存的比較記錄」：
//   - 讀取現有的儲存記錄
//   - 新增一筆儲存記錄
//
// 目前存放方式：JavaScript 模組層級的變數（savedRuns）
//   → 優點：簡單，不需要後端
//   → 缺點：重新整理頁面後資料就消失了
// 未來：可以改成存進 localStorage 或送到後端資料庫
// ========================================================

import { mockSavedComparisons } from "../mocks/comparisons";
import type { EvaluationConfig, EvaluationResult, SavedComparison, UploadedDatasets } from "../types/contracts";

// 用模組層級的變數當作「暫時的資料庫」
// 初始值是 mock 資料的複製（[...array] 是淺拷貝，避免直接修改原始 mock）
let savedRuns: SavedComparison[] = [...mockSavedComparisons];

// 回傳目前所有儲存的比較記錄
export function getSavedComparisons(): SavedComparison[] {
  return savedRuns;
}

// 儲存一筆新的比較記錄，並回傳更新後的完整清單
// 參數用「物件解構」接收，讓呼叫端不用記參數順序
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

  // 建立新的一筆記錄
  const newRun: SavedComparison = {
    // 用當前時間戳記當 id，確保唯一（now.getTime() 回傳毫秒數）
    id: `run-${now.getTime()}`,
    runName: `Prototype evaluation - ${uploadedDatasets.syntheticDataset?.fileName ?? "V1_syn.csv"}`,
    createdAt: now.toISOString(),        // 機器用的時間格式
    createdAtLabel: now.toLocaleDateString(), // 人看的時間格式（依系統地區設定）
    realDatasetName: uploadedDatasets.realDataset?.fileName ?? "diabetic_data.csv",
    syntheticDatasetName: uploadedDatasets.syntheticDataset?.fileName ?? "V1_syn.csv",
    overallSimilarityScore: evaluationResult.summary.overallSimilarityScore,
    metricsUsed: evaluationConfig.selectedMetrics,
    status: "completed",
  };

  // 把新記錄放到最前面（最新的在上面）
  savedRuns = [newRun, ...savedRuns];
  return savedRuns;
}
