// ========================================================
// mocks/validation.ts — 假的驗證結果資料
// ========================================================
// 模擬「後端分析完兩個資料集後回傳的驗證摘要」。
// 數字均從真實的 diabetic_data.csv 和 V1_syn.csv 計算得出。
//
// 缺失值定義：空字串、"?"、"None" 字串都算缺失
// （diabetic_data.csv 用 "None" 字串表示沒有資料）
// ========================================================

import type { ValidationSummary } from "../types/contracts";

export const mockValidationSummary: ValidationSummary = {
  // 真實資料集的基本統計
  realDataset: {
    fileId: "real-001",
    fileName: "diabetic_data.csv",
    rowCount: 101766,
    columnCount: 50,
    missingValueCount: 374017, // 計入 "None" 字串後的真實缺失值總數
    duplicateRowCount: 0,
    missingColumnCount: 8, // weight/medical_specialty/payer_code/max_glu_serum/A1Cresult/race/diag_2/diag_3
  },
  // 合成資料集的基本統計
  syntheticDataset: {
    fileId: "syn-001",
    fileName: "V1_syn.csv",
    rowCount: 101766,
    columnCount: 50,
    missingValueCount: 372705, // 與真實資料相差僅 0.4%，AI 學到了缺失模式
    duplicateRowCount: 0,
    missingColumnCount: 8, // 同樣 8 個欄位有缺失，模式被完整複製
  },
  // 49 欄名稱對齊，1 欄 type mismatch（number_outpatient）
  matchedColumnCount: 49,
  unmatchedColumnCount: 1,

  // Schema comparison rows — sorted by severity then missingness.
  // Backend sorts: type_mismatch first, then high-missingness descending, then clean columns.
  schemaComparison: [
    // Type mismatch（最嚴重，排最前面）
    { id: "number_outpatient", columnName: "number_outpatient", realType: "numerical", syntheticType: "categorical", realMissingRate: 0, syntheticMissingRate: 0, status: "type_mismatch" },

    // 高缺失率欄位（由高到低排序）
    { id: "weight",            columnName: "weight",            realType: "categorical", syntheticType: "categorical", realMissingRate: 96.9, syntheticMissingRate: 96.9, status: "matched" },
    { id: "max_glu_serum",     columnName: "max_glu_serum",     realType: "categorical", syntheticType: "categorical", realMissingRate: 94.7, syntheticMissingRate: 94.6, status: "matched" },
    { id: "A1Cresult",         columnName: "A1Cresult",         realType: "categorical", syntheticType: "categorical", realMissingRate: 83.3, syntheticMissingRate: 82.8, status: "matched" },
    { id: "medical_specialty", columnName: "medical_specialty", realType: "categorical", syntheticType: "categorical", realMissingRate: 49.1, syntheticMissingRate: 48.5, status: "matched" },
    { id: "payer_code",        columnName: "payer_code",        realType: "categorical", syntheticType: "categorical", realMissingRate: 39.6, syntheticMissingRate: 39.4, status: "matched" },
    { id: "race",              columnName: "race",              realType: "categorical", syntheticType: "categorical", realMissingRate: 2.2,  syntheticMissingRate: 2.1,  status: "matched" },
    { id: "diag_3",            columnName: "diag_3",            realType: "categorical", syntheticType: "categorical", realMissingRate: 1.4,  syntheticMissingRate: 1.5,  status: "matched" },
    { id: "diag_2",            columnName: "diag_2",            realType: "categorical", syntheticType: "categorical", realMissingRate: 0.4,  syntheticMissingRate: 0.4,  status: "matched" },

    // 代表性的乾淨欄位（結果變數、用藥、數值型、人口統計各一筆）
    { id: "readmitted",       columnName: "readmitted",       realType: "categorical", syntheticType: "categorical", realMissingRate: 0, syntheticMissingRate: 0, status: "matched" },
    { id: "insulin",          columnName: "insulin",          realType: "categorical", syntheticType: "categorical", realMissingRate: 0, syntheticMissingRate: 0, status: "matched" },
    { id: "time_in_hospital", columnName: "time_in_hospital", realType: "numerical",   syntheticType: "numerical",   realMissingRate: 0, syntheticMissingRate: 0, status: "matched" },
    { id: "age",              columnName: "age",              realType: "categorical", syntheticType: "categorical", realMissingRate: 0, syntheticMissingRate: 0, status: "matched" },
  ],

  // 全部 50 欄的清單，由後端在 profiling 階段從 CSV header 讀取後回傳
  // Setup 頁用這份清單讓使用者自由選擇要評估哪些欄位
  availableColumns: [
    // ID 欄位（通常不選入評估，但仍列出讓使用者決定）
    { columnName: "encounter_id",                  dataType: "numerical"   },
    { columnName: "patient_nbr",                   dataType: "numerical"   },
    // 人口統計
    { columnName: "race",                          dataType: "categorical" },
    { columnName: "gender",                        dataType: "categorical" },
    { columnName: "age",                           dataType: "categorical" },
    { columnName: "weight",                        dataType: "categorical" },
    // 入院資訊
    { columnName: "admission_type_id",             dataType: "numerical"   },
    { columnName: "discharge_disposition_id",      dataType: "numerical"   },
    { columnName: "admission_source_id",           dataType: "numerical"   },
    { columnName: "time_in_hospital",              dataType: "numerical"   },
    { columnName: "payer_code",                    dataType: "categorical" },
    { columnName: "medical_specialty",             dataType: "categorical" },
    // 使用量欄位
    { columnName: "num_lab_procedures",            dataType: "numerical"   },
    { columnName: "num_procedures",                dataType: "numerical"   },
    { columnName: "num_medications",               dataType: "numerical"   },
    { columnName: "number_outpatient",             dataType: "numerical"   },
    { columnName: "number_emergency",              dataType: "numerical"   },
    { columnName: "number_inpatient",              dataType: "numerical"   },
    { columnName: "number_diagnoses",              dataType: "numerical"   },
    // 診斷
    { columnName: "diag_1",                        dataType: "categorical" },
    { columnName: "diag_2",                        dataType: "categorical" },
    { columnName: "diag_3",                        dataType: "categorical" },
    // 血糖相關
    { columnName: "max_glu_serum",                 dataType: "categorical" },
    { columnName: "A1Cresult",                     dataType: "categorical" },
    // 用藥欄位
    { columnName: "metformin",                     dataType: "categorical" },
    { columnName: "repaglinide",                   dataType: "categorical" },
    { columnName: "nateglinide",                   dataType: "categorical" },
    { columnName: "chlorpropamide",                dataType: "categorical" },
    { columnName: "glimepiride",                   dataType: "categorical" },
    { columnName: "acetohexamide",                 dataType: "categorical" },
    { columnName: "glipizide",                     dataType: "categorical" },
    { columnName: "glyburide",                     dataType: "categorical" },
    { columnName: "tolbutamide",                   dataType: "categorical" },
    { columnName: "pioglitazone",                  dataType: "categorical" },
    { columnName: "rosiglitazone",                 dataType: "categorical" },
    { columnName: "acarbose",                      dataType: "categorical" },
    { columnName: "miglitol",                      dataType: "categorical" },
    { columnName: "troglitazone",                  dataType: "categorical" },
    { columnName: "tolazamide",                    dataType: "categorical" },
    { columnName: "examide",                       dataType: "categorical" },
    { columnName: "citoglipton",                   dataType: "categorical" },
    { columnName: "insulin",                       dataType: "categorical" },
    { columnName: "glyburide-metformin",           dataType: "categorical" },
    { columnName: "glipizide-metformin",           dataType: "categorical" },
    { columnName: "glimepiride-pioglitazone",      dataType: "categorical" },
    { columnName: "metformin-rosiglitazone",       dataType: "categorical" },
    { columnName: "metformin-pioglitazone",        dataType: "categorical" },
    // 結果欄位
    { columnName: "change",                        dataType: "categorical" },
    { columnName: "diabetesMed",                   dataType: "categorical" },
    { columnName: "readmitted",                    dataType: "categorical" },
  ],

  // 驗證發現（後端根據規則自動產生，嚴重的排前面）
  issues: [
    {
      level: "warning",
      code: "TYPE_MISMATCH",
      message: "number_outpatient is numerical in the real dataset but categorical in the synthetic dataset. Evaluation metrics for this column may be unreliable.",
    },
    {
      level: "info",
      code: "SCHEMA_PARTIALLY_MATCHED",
      message: "49 of 50 columns are aligned by name and type. 1 type mismatch detected.",
    },
    {
      level: "warning",
      code: "HIGH_MISSINGNESS",
      message: "weight (96.9%), max_glu_serum (94.7%), A1Cresult (83.3%), medical_specialty (49.1%), and payer_code (39.6%) have high missing rates — interpret results for these columns carefully.",
    },
    {
      level: "info",
      code: "MISSINGNESS_PRESERVED",
      message: "The synthetic dataset closely replicates the real missingness pattern — no column differs by more than 1% between the two files.",
    },
  ],

  canProceed: true,
};
