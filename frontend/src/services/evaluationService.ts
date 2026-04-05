// ========================================================
// evaluationService.ts — 統計評估的「服務層」
// ========================================================
// 負責兩件事：
//   1. 提供可用的統計指標清單（給 Setup 頁顯示選項）
//   2. 模擬「執行評估」並回傳結果（給 Results 頁顯示）
//
// 真實版本：會把使用者選的指標和欄位送到 FastAPI 後端，
//           後端用 Python（scipy / pandas）跑統計，回傳結果。
// 現在：直接回傳 mock 結果，但會把使用者的設定附上去（appliedConfig）
// ========================================================

import { mockEvaluationResult } from "../mocks/results";
import type { EvaluationConfig, EvaluationResult, MetricDefinition } from "../types/contracts";

// 所有可用的統計評估指標清單
// 這個陣列同時用於：
//   - Setup 頁的「選指標」區域（顯示 label 和 description）
//   - Results 頁把 metric key 轉換回可讀的 label
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
    // 比較一個數值變數在各類別群組的分布是否被合成資料保留
    // 例如：time_in_hospital 按 readmitted 分組，比較真實 vs 合成的群組分布差異
    // 後端使用 Kruskal-Wallis 檢定（非參數，對分布形狀不做假設）
    key: "numerical_categorical_association",
    label: "Numerical–Categorical Association",
    description: "Compares how a numerical variable's distribution shifts across categories (e.g., time_in_hospital by readmitted) between real and synthetic data.",
    appliesTo: "cross_type",
  },
];

// 產生預設的評估設定（使用者第一次進 Setup 頁時用的初始值）
export function getDefaultEvaluationConfig(): EvaluationConfig {
  return {
    selectedMetrics: ["mean_difference", "ks_test", "chi_square"], // 預設勾選三個
    selectedColumns: [],        // 預設沒有選欄位（由 Setup 頁處理）
    // 以下四個欄位是後端參數，不在 Setup UI 顯示
    // 使用者看不到，後端收到 config 時直接用這些預設值
    includeNumerical: true,
    includeCategorical: true,
    missingValueHandling: "ignore",
    significanceLevel: 0.05,
  };
}

// 模擬「執行評估」的函式
// 真實版本：POST request 到 FastAPI，附上 config，等待回傳結果
// 現在：直接回傳 mock 結果，但把使用者的 config 附上去讓資料更完整
export async function runEvaluation(config: EvaluationConfig): Promise<EvaluationResult> {
  return Promise.resolve({
    ...mockEvaluationResult,  // 展開所有假資料
    appliedConfig: config,    // 把這次的設定記錄進去
  });
}
