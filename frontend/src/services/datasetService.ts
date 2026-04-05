// ========================================================
// datasetService.ts — 資料集上傳與驗證的「服務層」
// ========================================================
// 服務層（Service）的概念：
//   把「資料操作邏輯」從頁面元件裡抽出來，放到這裡。
//   頁面只需要呼叫這裡的函式，不用知道資料怎麼來的。
//
// 目前狀態：全部都是「假的」（mock），直接回傳測試資料。
// 未來：把這裡換成真正的 API 呼叫（fetch / axios），頁面元件不需要改。
//
// async / await 概念：
//   async function → 這個函式會做「需要等待的事情」（例如網路請求）
//   await          → 等這件事做完再繼續
//   Promise.resolve(x) → 直接建立一個「已完成」的 Promise，回傳值是 x
//                        現在用這個來假裝是非同步操作
// ========================================================

import { mockDatasets } from "../mocks/datasets";
import { mockValidationSummary } from "../mocks/validation";
import type { UploadFilesInput, UploadedDatasets, ValidationSummary } from "../types/contracts";

// 模擬「上傳資料集」的函式
// 真實情況下：這裡會把檔案用 multipart/form-data 傳到後端 API
// 現在：直接用 mock 資料，但會把使用者選的檔名和大小套進去（讓畫面更真實）
export async function uploadDatasets(files: UploadFilesInput): Promise<UploadedDatasets> {
  // 記錄上傳時間（ISO 格式字串，例如 "2026-04-04T10:30:00.000Z"）
  const now = new Date().toISOString();

  // Promise.resolve(...) 直接回傳一個「已完成的 Promise」，模擬非同步
  return Promise.resolve({
    realDataset: mockDatasets.realDataset
      ? {
          // 展開 mock 資料的所有欄位（...mockDatasets.realDataset）
          // 再用使用者實際選的檔案蓋掉 fileName 和 sizeBytes
          // ?? 是「空值合併運算子」：左邊是 null/undefined 就用右邊的值
          ...mockDatasets.realDataset,
          fileName: files.realFile?.name ?? mockDatasets.realDataset.fileName,
          sizeBytes: files.realFile?.size ?? mockDatasets.realDataset.sizeBytes,
          uploadedAt: now,
        }
      : null,
    syntheticDataset: mockDatasets.syntheticDataset
      ? {
          ...mockDatasets.syntheticDataset,
          fileName: files.syntheticFile?.name ?? mockDatasets.syntheticDataset.fileName,
          sizeBytes: files.syntheticFile?.size ?? mockDatasets.syntheticDataset.sizeBytes,
          uploadedAt: now,
        }
      : null,
  });
}

// 模擬「取得驗證摘要」的函式
// 真實情況下：後端收到檔案後會分析欄位結構，回傳比較結果
// 現在：直接回傳固定的假資料
export async function getValidationSummary(): Promise<ValidationSummary> {
  return Promise.resolve(mockValidationSummary);
}
