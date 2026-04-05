// ========================================================
// mocks/datasets.ts — 假的資料集上傳資訊
// ========================================================
// Mock（假資料）的用途：
//   在後端還沒做好時，前端可以用假資料來跑畫面，
//   讓我們可以設計和測試 UI，不需要等後端。
//
// 這裡模擬「兩個資料集已上傳並驗證通過」的狀態。
// 用的是真實的糖尿病資料集資訊（檔案名稱、大小都是真的）。
// ========================================================

import type { UploadedDatasets } from "../types/contracts";

export const mockDatasets: UploadedDatasets = {
  // 真實病人資料（diabetic_data.csv 是公開的 UCI 糖尿病資料集）
  realDataset: {
    id: "real-001",
    role: "real",
    fileName: "diabetic_data.csv",
    fileType: "csv",
    sizeBytes: 19159383,   // 約 18.3 MB
    uploadedAt: "2026-04-02T09:00:00Z",
    status: "validated",   // 已驗證通過
  },
  // 合成資料（由 AI 模型生成，用來模擬真實資料）
  syntheticDataset: {
    id: "syn-001",
    role: "synthetic",
    fileName: "V1_syn.csv",
    fileType: "csv",
    sizeBytes: 18674903,   // 約 17.8 MB（略小於真實資料）
    uploadedAt: "2026-04-02T09:02:00Z",
    status: "validated",
  },
};
